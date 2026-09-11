export type ConfirmationProjection = { ok: true; type: 'organizer_confirmations'; year: string; events: { event_id: string; data_confirmed: true }[] };

export const hasConfirmedOrganizerData = (payload: unknown, year: string, eventId: string): boolean => {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<ConfirmationProjection>;
  return value.ok === true && value.type === 'organizer_confirmations' && value.year === year && Array.isArray(value.events) &&
    value.events.some((item) => item && item.event_id === eventId && item.data_confirmed === true);
};
