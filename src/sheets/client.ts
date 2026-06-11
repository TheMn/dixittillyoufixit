/// <reference types="google-apps-script" />
import { SPREADSHEET_ID } from "../vars";

export type Row = Record<string, string>;

function applyPatch(base: Row, patch: Partial<Row>): Row {
  const result: Row = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export interface ISheetsClient {
  getRows(sheetName: string): Row[];
  findRow(sheetName: string, column: string, value: string): Row | null;
  findRows(sheetName: string, column: string, value: string): Row[];
  appendRow(sheetName: string, row: Row): void;
  updateRow(sheetName: string, idColumn: string, idValue: string, data: Partial<Row>): void;
  deleteRow(sheetName: string, idColumn: string, idValue: string): void;
  upsertRow(sheetName: string, idColumn: string, row: Row): void;
}

export class MockSheetsClient implements ISheetsClient {
  private data: Map<string, Row[]> = new Map();

  private sheet(sheetName: string): Row[] {
    if (!this.data.has(sheetName)) this.data.set(sheetName, []);
    return this.data.get(sheetName)!;
  }

  getRows(sheetName: string): Row[] {
    return this.sheet(sheetName).map(row => ({ ...row }));
  }

  findRow(sheetName: string, column: string, value: string): Row | null {
    const found = this.sheet(sheetName).find(row => row[column] === value);
    return found ? { ...found } : null;
  }

  findRows(sheetName: string, column: string, value: string): Row[] {
    return this.sheet(sheetName)
      .filter(row => row[column] === value)
      .map(row => ({ ...row }));
  }

  appendRow(sheetName: string, row: Row): void {
    this.sheet(sheetName).push({ ...row });
  }

  updateRow(sheetName: string, idColumn: string, idValue: string, data: Partial<Row>): void {
    const rows = this.sheet(sheetName);
    const index = rows.findIndex(row => row[idColumn] === idValue);
    if (index === -1)
      throw new Error(`Row not found: ${sheetName}[${idColumn}="${idValue}"]`);
    rows[index] = applyPatch(rows[index], data);
  }

  deleteRow(sheetName: string, idColumn: string, idValue: string): void {
    const rows = this.sheet(sheetName);
    const index = rows.findIndex(row => row[idColumn] === idValue);
    if (index === -1)
      throw new Error(`Row not found: ${sheetName}[${idColumn}="${idValue}"]`);
    rows.splice(index, 1);
  }

  upsertRow(sheetName: string, idColumn: string, row: Row): void {
    const rows = this.sheet(sheetName);
    const index = rows.findIndex(r => r[idColumn] === row[idColumn]);
    if (index === -1) {
      rows.push({ ...row });
    } else {
      rows[index] = { ...rows[index], ...row };
    }
  }
}

export class GASheetsClient implements ISheetsClient {
  private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  constructor(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {
    this.spreadsheet = spreadsheet;
  }

  private getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
    return sheet;
  }

  private headers(sheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
    return (sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues() as unknown[][])[0].map(String);
  }

  private toRow(headers: string[], values: unknown[]): Row {
    return Object.fromEntries(headers.map((h, i) => [h, String(values[i] ?? "")]));
  }

  private toValues(headers: string[], row: Row): string[] {
    return headers.map(h => row[h] ?? "");
  }

  getRows(sheetName: string): Row[] {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const hdrs = this.headers(sheet);
    const values = sheet.getRange(2, 1, lastRow - 1, hdrs.length).getValues() as unknown[][];
    return values.map(v => this.toRow(hdrs, v));
  }

  findRow(sheetName: string, column: string, value: string): Row | null {
    return this.getRows(sheetName).find(row => row[column] === value) ?? null;
  }

  findRows(sheetName: string, column: string, value: string): Row[] {
    return this.getRows(sheetName).filter(row => row[column] === value);
  }

  appendRow(sheetName: string, row: Row): void {
    const sheet = this.getSheet(sheetName);
    const hdrs = this.headers(sheet);
    sheet.appendRow(this.toValues(hdrs, row));
  }

  updateRow(sheetName: string, idColumn: string, idValue: string, data: Partial<Row>): void {
    const sheet = this.getSheet(sheetName);
    const hdrs = this.headers(sheet);
    const rows = this.getRows(sheetName);
    const index = rows.findIndex(row => row[idColumn] === idValue);
    if (index === -1)
      throw new Error(`Row not found: ${sheetName}[${idColumn}="${idValue}"]`);
    const updated = applyPatch(rows[index], data);
    sheet.getRange(index + 2, 1, 1, hdrs.length).setValues([this.toValues(hdrs, updated)]);
  }

  deleteRow(sheetName: string, idColumn: string, idValue: string): void {
    const sheet = this.getSheet(sheetName);
    const rows = this.getRows(sheetName);
    const index = rows.findIndex(row => row[idColumn] === idValue);
    if (index === -1)
      throw new Error(`Row not found: ${sheetName}[${idColumn}="${idValue}"]`);
    sheet.deleteRow(index + 2);
  }

  upsertRow(sheetName: string, idColumn: string, row: Row): void {
    const existing = this.findRow(sheetName, idColumn, row[idColumn]);
    if (existing) {
      this.updateRow(sheetName, idColumn, row[idColumn], row);
    } else {
      this.appendRow(sheetName, row);
    }
  }
}

export function createSheetsClient(): ISheetsClient {
  if ("SpreadsheetApp" in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new GASheetsClient((globalThis as any).SpreadsheetApp.openById(SPREADSHEET_ID));
  }
  return new MockSheetsClient();
}
