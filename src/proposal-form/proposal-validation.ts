// @ts-nocheck
// Keep the paired Apps Script ProposalValidation.js byte-identical except for this line and exports.
const STK_PROPOSAL_TYPES = ['Nov tek (dodajanje nove prireditve)', 'Popravek obstoječega vnosa v koledarju', 'Dopolnitev dodatnih podatkov obstoječega teka', 'Drugo'];
const STK_PROPOSAL_REGIONS = ['Pomurska', 'Podravska', 'Koroška', 'Savinjska', 'Zasavska', 'Posavska', 'Jugovzhodna', 'Primorsko-notranjska', 'Osrednjeslovenska', 'Gorenjska', 'Goriška', 'Obalno-kraška', 'Ne vem / nisem prepričan (navedem v opisu)'];
const STK_PROPOSAL_ADDITIONAL = ['Prijavnina / startnina', 'Rok prijave', 'Cenejša prijava / sprememba cene', 'Prijave na dan dogodka', 'Trasa / zemljevid / GPX', 'Višinski metri', 'Popravek napačnega dodatnega podatka', 'Drugo'];
const STK_PROPOSAL_LIMITS = { proposalType: 100, date: 10, title: 200, place: 200, region: 100, officialSource: 1000, description: 6000, organizer: 2, officialAnnouncement: 6, email: 254 };
function stkValidateProposal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(STK_PROPOSAL_LIMITS).concat('additionalData');
  if (Object.keys(input).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(input, k))) return null;
  const clean = {};
  for (const key of Object.keys(STK_PROPOSAL_LIMITS)) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > STK_PROPOSAL_LIMITS[key] ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<[^>]*>|(?:javascript|vbscript|data)\s*:/i.test(value) ||
        (key !== 'description' && /[\r\n\t]/.test(value))) return null;
    clean[key] = value.trim().normalize('NFC');
    if (key !== 'officialSource' && !clean[key]) return null;
  }
  if (!STK_PROPOSAL_TYPES.includes(clean.proposalType) || !STK_PROPOSAL_REGIONS.includes(clean.region) ||
      !['Da', 'Ne'].includes(clean.organizer) || !['Da', 'Ne', 'Ne vem'].includes(clean.officialAnnouncement) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) || !/^\d{4}-\d{2}-\d{2}$/.test(clean.date)) return null;
  const date = new Date(clean.date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== clean.date || +clean.date.slice(0, 4) < 2000 || +clean.date.slice(0, 4) > 2100) return null;
  // No upstream fetch of user URLs. Reject credentials and unsafe URL schemes at both boundaries.
  if (clean.officialSource && (!/^https?:\/\/[^\s/@]+(?:[:/][^\s]*)?$/i.test(clean.officialSource) || /@/.test(clean.officialSource.split('/').slice(0, 3).join('/')))) return null;
  if (!Array.isArray(input.additionalData) || input.additionalData.length > STK_PROPOSAL_ADDITIONAL.length ||
      input.additionalData.some(v => typeof v !== 'string' || !STK_PROPOSAL_ADDITIONAL.includes(v)) || new Set(input.additionalData).size !== input.additionalData.length) return null;
  clean.additionalData = STK_PROPOSAL_ADDITIONAL.filter(v => input.additionalData.includes(v));
  if (clean.proposalType === STK_PROPOSAL_TYPES[2] && !clean.additionalData.length) return null;
  return clean;
}
export { stkValidateProposal, STK_PROPOSAL_LIMITS };
