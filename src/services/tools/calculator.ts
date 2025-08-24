export function safeCalculate(expression: string): number | null {
  // Allow only digits, spaces, parentheses, and +-*/.% operators
  if (!/^[-+*/%.() 0-9]+$/.test(expression)) {return null;}
  try {
     
    const fn = new Function(`return (${expression})`);
    const res = fn();
    if (typeof res === 'number' && Number.isFinite(res)) {return res;}
    return null;
  } catch {
    return null;
  }
}
