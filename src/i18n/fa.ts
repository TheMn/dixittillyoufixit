export const fa: Record<string, string> = {
  // player
  "player.welcome": "به ربات دیکسیت خوش آمدید! برای شروع بازی از /newgame استفاده کنید.",
  "player.joined": "{{username}} به بازی پیوست!",
  "player.full": "بازی پر است (حداکثر ۶ بازیکن).",
  "player.already_joined": "شما قبلاً در این بازی هستید.",
  "player.lang_set": "زبان به فارسی تغییر یافت.",

  // game
  "game.created": "بازی ایجاد شد! دیگران می‌توانند با /join بپیوندند.",
  "game.started": "بازی شروع شد!",
  "game.not_found": "هیچ بازی فعالی در این چت یافت نشد.",
  "game.already_active": "یک بازی از قبل در این چت فعال است.",
  "game.not_enough_players": "برای شروع حداقل ۳ بازیکن نیاز است.",
  "game.ended": "بازی تمام شد!",
  "game.winner": "برنده: {{username}} با {{score}} امتیاز!",

  // round
  "round.start": "دور {{round}} شروع شد!",
  "round.give_clue": "{{username}}، تو داستان‌پرداز هستی. یک سرنخ برای کارتت بفرست.",
  "round.submit_card": "یک کارت که با سرنخ «{{clue}}» مناسب است انتخاب کن.",
  "round.waiting_submissions": "منتظر {{count}} بازیکن دیگر برای ارسال کارت هستیم.",
  "round.vote": "همه کارت‌ها آماده‌اند! برای کارت داستان‌پرداز رأی بده.",
  "round.reveal": "در حال نمایش نتایج...",
  "round.scores": "امتیازات این دور:",
  "round.next": "دور بعدی به زودی شروع می‌شود...",

  // scoring
  "scoring.storyteller_zero": "داستان‌پرداز ۰ امتیاز گرفت — همه یا هیچ‌کس درست حدس زد!",
  "scoring.correct_guess": "{{username}} +۳ (حدس درست)",
  "scoring.bonus_vote": "{{username}} +{{votes}} رأی اضافی",

  // error
  "error.generic": "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
  "error.unknown_command": "دستور ناشناخته. از /help برای راهنمایی استفاده کنید.",

  // leaderboard
  "leaderboard.title": "جدول امتیازات",
  "leaderboard.entry": "{{rank}}. {{username}} — {{score}} امتیاز ({{wins}} برد)",
  "leaderboard.empty": "هنوز هیچ بازی‌ای انجام نشده است.",
};
