export function pad(n){ return n < 10 ? '0' + n : '' + n; }

// Formats JS Date -> 'YYYY-MM-DD HH:mm:ss.SSS' in local time
export function formatLmDate(d){
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}.${mmm}`;
}