const test = require("node:test");
const assert = require("node:assert/strict");

const {
  countOverlappingISTDays,
  getDaysInMonth,
  getISTDateString,
  getISTDayIndex,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../src/utils/dateUtils");

const WINDOW = getISTMonthBounds(2026, 9);

test("getISTDateString resolves the IST calendar day", () => {
  // 18:30 UTC is already the 19th in IST (UTC+05:30).
  assert.equal(
    getISTDateString(new Date("2026-09-18T18:30:00.000Z")),
    "2026-09-19"
  );
  assert.equal(
    getISTDateString(new Date("2026-09-18T18:29:59.999Z")),
    "2026-09-18"
  );
});

test("getISTDayIndex is stable across UTC and IST midnight storage", () => {
  const asUtcMidnight = new Date("2026-09-19");
  const asIstMidnight = new Date("2026-09-19T00:00:00+05:30");

  assert.notEqual(asUtcMidnight.getTime(), asIstMidnight.getTime());
  assert.equal(getISTDayIndex(asUtcMidnight), getISTDayIndex(asIstMidnight));
});

test("getISTDayIndex increments by exactly one per calendar day", () => {
  assert.equal(
    getISTDayIndex(new Date("2026-09-02T00:00:00+05:30")) -
      getISTDayIndex(new Date("2026-09-01T00:00:00+05:30")),
    1
  );
});

test("getISTMonthBounds covers the whole month in IST", () => {
  assert.equal(getISTDateString(WINDOW.start), "2026-09-01");
  assert.equal(getISTDateString(WINDOW.end), "2026-09-30");
});

test("getISTMonthBounds handles February and a 31 day month", () => {
  assert.equal(getISTDateString(getISTMonthBounds(2026, 2).end), "2026-02-28");
  assert.equal(getISTDateString(getISTMonthBounds(2024, 2).end), "2024-02-29");
  assert.equal(getISTDateString(getISTMonthBounds(2026, 1).end), "2026-01-31");
  assert.equal(getISTDateString(getISTMonthBounds(2026, 12).end), "2026-12-31");
});

test("getDaysInMonth is independent of the host timezone", () => {
  assert.equal(getDaysInMonth(2026, 9), 30);
  assert.equal(getDaysInMonth(2026, 2), 28);
  assert.equal(getDaysInMonth(2024, 2), 29);
  assert.equal(getDaysInMonth(2026, 12), 31);
});

test("isValidMonth rejects malformed and out of range months", () => {
  assert.equal(isValidMonth("2026-09"), true);
  assert.equal(isValidMonth("2026-12"), true);
  assert.equal(isValidMonth("2026-13"), false);
  assert.equal(isValidMonth("2026-00"), false);
  assert.equal(isValidMonth("2026-9"), false);
  assert.equal(isValidMonth("26-09"), false);
  assert.equal(isValidMonth(""), false);
  assert.equal(isValidMonth(null), false);
  assert.equal(isValidMonth(202609), false);
});

test("parseMonth splits a validated month", () => {
  assert.deepEqual(parseMonth("2026-09"), { year: 2026, month: 9 });
});

test("countOverlappingISTDays counts an in-range leave inclusively", () => {
  const count = countOverlappingISTDays(
    new Date("2026-09-18T00:00:00+05:30"),
    new Date("2026-09-19T00:00:00+05:30"),
    WINDOW.start,
    WINDOW.end
  );

  assert.equal(count, 2);
});

test("countOverlappingISTDays clamps a leave that starts in a prior month", () => {
  // September 1 through September 19 inclusive is 19 days.
  const count = countOverlappingISTDays(
    new Date("2026-08-30"),
    new Date("2026-09-19"),
    WINDOW.start,
    WINDOW.end
  );

  assert.equal(count, 19);
});

test("countOverlappingISTDays counts a leave that crosses an IST midnight", () => {
  // Regression. The previous implementation computed
  // Math.floor((end - start) / 86400000) + 1, which counts elapsed 24 hour
  // periods rather than calendar days. This leave is 18.5 hours long and both
  // ends fall on the same UTC day, but it spans two IST days, so the old code
  // returned 1 and silently dropped a paid leave day.
  const count = countOverlappingISTDays(
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-01T18:30:00.000Z"),
    getISTMonthBounds(2026, 1).start,
    getISTMonthBounds(2026, 1).end
  );

  assert.equal(count, 2);
});

test("countOverlappingISTDays never undercounts a multi day leave", () => {
  // Sweeps every start time of day against a five day leave and asserts the
  // result is always 5, which the elapsed-24-hour-period formula could not do.
  const window = getISTMonthBounds(2026, 5);
  const offsetsInHours = [0, 5.5, 12, 18.5, 23.5, -5.5];

  for (const offset of offsetsInHours) {
    const start = new Date(
      Date.UTC(2026, 4, 10) + offset * 60 * 60 * 1000
    );
    const end = new Date(
      Date.UTC(2026, 4, 14) + offset * 60 * 60 * 1000
    );

    assert.equal(
      countOverlappingISTDays(start, end, window.start, window.end),
      5,
      `offset ${offset}h produced the wrong day count`
    );
  }
});

test("countOverlappingISTDays clamps a leave that ends in a later month", () => {
  const count = countOverlappingISTDays(
    new Date("2026-09-25T00:00:00+05:30"),
    new Date("2026-10-05T00:00:00+05:30"),
    WINDOW.start,
    WINDOW.end
  );

  assert.equal(count, 6);
});

test("countOverlappingISTDays gives the same answer for UTC and IST storage", () => {
  const utcCount = countOverlappingISTDays(
    new Date("2026-08-30"),
    new Date("2026-09-19"),
    WINDOW.start,
    WINDOW.end
  );
  const istCount = countOverlappingISTDays(
    new Date("2026-08-30T00:00:00+05:30"),
    new Date("2026-09-19T00:00:00+05:30"),
    WINDOW.start,
    WINDOW.end
  );

  assert.equal(utcCount, 19);
  assert.equal(istCount, utcCount);
});

test("countOverlappingISTDays returns 0 for non overlapping ranges", () => {
  assert.equal(
    countOverlappingISTDays(
      new Date("2026-07-01T00:00:00+05:30"),
      new Date("2026-07-05T00:00:00+05:30"),
      WINDOW.start,
      WINDOW.end
    ),
    0
  );
  assert.equal(
    countOverlappingISTDays(
      new Date("2026-11-01T00:00:00+05:30"),
      new Date("2026-11-05T00:00:00+05:30"),
      WINDOW.start,
      WINDOW.end
    ),
    0
  );
});

test("countOverlappingISTDays covers an entire month in one go", () => {
  const december = getISTMonthBounds(2026, 12);

  assert.equal(
    countOverlappingISTDays(
      new Date("2026-01-01T00:00:00+05:30"),
      new Date("2027-01-01T00:00:00+05:30"),
      december.start,
      december.end
    ),
    31
  );
});

test("countOverlappingISTDays counts a single day leave as one", () => {
  const count = countOverlappingISTDays(
    new Date("2026-09-14"),
    new Date("2026-09-14"),
    WINDOW.start,
    WINDOW.end
  );

  assert.equal(count, 1);
});
