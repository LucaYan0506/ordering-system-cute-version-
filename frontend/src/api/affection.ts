export function affection(value: string | number) {
  const numberValue = Number(value);
  const clean = Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
  return `${clean}亲亲`;
}
