export const IST_TIMEZONE = "Asia/Kolkata";

const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// The API buckets every record by IST calendar day, so the month pickers must
// resolve "now" in IST too. Reading the host's local month instead reports the
// wrong month on any machine that is not set to IST, which shows up as an empty
// history around a month boundary.
export const getCurrentISTMonth = (date = new Date()) =>
  monthFormatter.format(date);

export const formatISTDate = (date) => dateFormatter.format(new Date(date));

export const formatISTTime = (date) =>
  date ? timeFormatter.format(new Date(date)) : "--:--";
