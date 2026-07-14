export type TodayNextStepId =
  | "login"
  | "create-couple"
  | "invite-partner"
  | "unread"
  | "answer-question"
  | "open-partner-answer"
  | "quick-reply"
  | "watch"
  | "goal"
  | "quiz";

export type TodayNextStepInput = {
  isAuthenticated: boolean;
  hasCouple: boolean;
  hasPartner: boolean;
  hasUnread: boolean;
  hasMyAnswer: boolean;
  hasPartnerAnswer: boolean;
  watchRemaining: number;
  hasGoal: boolean;
  quizHref: string;
  unreadHref?: string | null;
};

export type TodayNextStep = {
  id: TodayNextStepId;
  label: string;
  title: string;
  text: string;
  href: string;
  button: string;
  icon: string;
};

export type DailyQuestionCouple = {
  partner_one_id: string | null;
  partner_two_id: string | null;
};

export type DailyQuestionAnswer = {
  answer_one: string | null;
  answer_two: string | null;
} | null;

export function getSafeDate(value?: string | null) {
  if (!value) return null;

  const directDate = new Date(value);
  if (Number.isFinite(directDate.getTime())) return directDate;

  const ruDateMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!ruDateMatch) return null;

  const [, day, month, year] = ruDateMatch;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
}

export function formatRuDate(value?: string | null) {
  const date = getSafeDate(value);
  if (!date) return "дата не указана";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatRuTime(value?: string | null) {
  const date = getSafeDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getDateTimestamp(value?: string | null) {
  return getSafeDate(value)?.getTime() || 0;
}

export function getTodayNextStep(input: TodayNextStepInput): TodayNextStep {
  if (!input.isAuthenticated) {
    return {
      id: "login",
      label: "Первый шаг",
      title: "Войдите, чтобы открыть день пары",
      text: "После входа здесь появится вопрос дня, чат и лучший следующий шаг.",
      href: "/login",
      button: "Войти",
      icon: "↗",
    };
  }

  if (!input.hasCouple) {
    return {
      id: "create-couple",
      label: "Первый шаг",
      title: "Создайте пару",
      text: "Общее пространство начнёт работать после создания пары.",
      href: "/profile",
      button: "Создать пару",
      icon: "♡",
    };
  }

  if (!input.hasPartner) {
    return {
      id: "invite-partner",
      label: "Приглашение",
      title: "Пригласите партнёра",
      text: "Сегодня станет общим экраном, когда второй человек присоединится.",
      href: "/profile",
      button: "Открыть профиль",
      icon: "＋",
    };
  }

  if (input.hasUnread) {
    return {
      id: "unread",
      label: "Новое",
      title: "Откройте последнее непрочитанное",
      text: "Сначала лучше ответить на то, что уже пришло от партнёра.",
      href: input.unreadHref || "/notifications",
      button: "Открыть",
      icon: "●",
    };
  }

  if (!input.hasMyAnswer) {
    return {
      id: "answer-question",
      label: "Ритуал дня",
      title: "Ответьте на вопрос дня",
      text: "Это самый короткий способ начать сегодняшний контакт.",
      href: "/questions/answer",
      button: "Ответить",
      icon: "✉",
    };
  }

  if (input.hasPartnerAnswer) {
    return {
      id: "open-partner-answer",
      label: "Ответ готов",
      title: "Откройте ответ партнёра",
      text: "Оба ответа уже есть, можно сравнить и оставить реакцию.",
      href: "/questions/today",
      button: "Открыть ответ",
      icon: "❤",
    };
  }

  if (input.hasMyAnswer) {
    return {
      id: "quick-reply",
      label: "Связь",
      title: "Напишите партнёру короткое сообщение",
      text: "Ваш ответ сохранён. Можно мягко позвать партнёра в сегодняшний ритуал.",
      href: "/today#quick-reply",
      button: "Написать",
      icon: "◌",
    };
  }

  if (input.watchRemaining > 0) {
    return {
      id: "watch",
      label: "Вечер",
      title: "Запустите рулетку просмотра",
      text: `${input.watchRemaining} вариантов ждут выбора на вечер.`,
      href: "/watch?spin=1",
      button: "Крутить",
      icon: "▥",
    };
  }

  if (input.hasGoal) {
    return {
      id: "goal",
      label: "Цель пары",
      title: "Отметьте прогресс по цели",
      text: "Один маленький шаг сегодня лучше большого плана на потом.",
      href: "/tracker",
      button: "Отметить",
      icon: "◫",
    };
  }

  return {
    id: "quiz",
    label: "Идея на сегодня",
    title: "Пройдите короткую викторину",
    text: "Ответьте отдельно и сравните результаты.",
    href: input.quizHref,
    button: "Начать",
    icon: "✦",
  };
}

export function getDailyQuestionReminderRecipients(
  couple: DailyQuestionCouple,
  answer: DailyQuestionAnswer,
) {
  const recipients: string[] = [];

  if (couple.partner_one_id && !answer?.answer_one) {
    recipients.push(couple.partner_one_id);
  }

  if (couple.partner_two_id && !answer?.answer_two) {
    recipients.push(couple.partner_two_id);
  }

  return recipients;
}
