const { formatInTimeZone } = require("date-fns-tz");

const IST_TIMEZONE = "Asia/Kolkata";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar day as observed in IST, regardless of how the instant is stored.
const getISTDateString = (date = new Date()) =>
  formatInTimeZone(date, IST_TIMEZONE, "yyyy-MM-dd");

// Whole-day index of the IST calendar day containing the given instant.
// Two instants on the same IST day always produce the same index, so
// differencing indexes counts calendar days without any timezone drift.
const getISTDayIndex = (date) => {
  const [year, month, day] = getISTDateString(date)
    .split("-")
    .map(Number);

  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

const getISTMonthBounds = (year, month) => {
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = getDaysInMonth(year, month);

  return {
    start: new Date(`${year}-${paddedMonth}-01T00:00:00+05:30`),
    end: new Date(
      `${year}-${paddedMonth}-${String(lastDay).padStart(
        2,
        "0"
      )}T23:59:59.999+05:30`
    ),
  };
};

const getDaysInMonth = (year, month) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const isValidMonth = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month] = value.split("-").map(Number);

  return month >= 1 && month <= 12;
};

const parseMonth = (value) => {
  const [year, month] = value.split("-").map(Number);

  return { year, month };
};

// Inclusive count of IST calendar days that both ranges share.
// A leave that starts before the window and ends inside it counts from the
// window's first day, so the clamp happens in day-index space where it is exact.
const countOverlappingISTDays = (
  rangeStart,
  rangeEnd,
  windowStart,
  windowEnd
) => {
  const from = Math.max(
    getISTDayIndex(rangeStart),
    getISTDayIndex(windowStart)
  );
  const to = Math.min(getISTDayIndex(rangeEnd), getISTDayIndex(windowEnd));

  return to < from ? 0 : to - from + 1;
};

const getISTDayIndexesInWindow = (dates, windowStart, windowEnd) => {
  const first = getISTDayIndex(windowStart);
  const last = getISTDayIndex(windowEnd);
  const indexes = new Set();

  for (const date of dates) {
    if (!date) continue;

    const index = getISTDayIndex(date);

    if (index >= first && index <= last) {
      indexes.add(index);
    }
  }

  return indexes;
};

module.exports = {
  IST_TIMEZONE,
  countOverlappingISTDays,
  getDaysInMonth,
  getISTDateString,
  getISTDayIndex,
  getISTDayIndexesInWindow,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
};
