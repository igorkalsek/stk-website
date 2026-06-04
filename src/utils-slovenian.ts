export const formatSloveneVoteCount = (count: number) => {
  const formattedCount = new Intl.NumberFormat('sl-SI').format(count);
  const lastTwoDigits = Math.abs(count) % 100;

  if (lastTwoDigits === 1) return `${formattedCount} glas`;
  if (lastTwoDigits === 2) return `${formattedCount} glasova`;
  if (lastTwoDigits === 3 || lastTwoDigits === 4) return `${formattedCount} glasovi`;
  return `${formattedCount} glasov`;
};
