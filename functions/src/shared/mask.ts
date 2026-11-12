export function last4(phone: string): string {
  return phone.replace(/\D/g, '').slice(-4);
}

/** '94770001234' -> '••• ••• 1234' */
export function maskPhone(phone: string): string {
  const l4 = last4(phone);
  return l4 ? `••• ••• ${l4}` : '';
}
