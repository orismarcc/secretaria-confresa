/**
 * Opens a WhatsApp chat for the given phone number.
 * Accepts any format (with or without country code, with or without formatting).
 */
export function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
}

/**
 * Returns the WhatsApp URL for a given phone number.
 */
export function whatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}
