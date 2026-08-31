export function formatEUR(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '€ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '€ 0,00';
  return `€ ${num.toFixed(2).replace('.', ',')}`;
}

export function formatMinutes(totalMinutes: number | undefined | null): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 00m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatTimeHHMM(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateShort(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
