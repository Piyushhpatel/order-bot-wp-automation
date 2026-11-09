export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

export function cartTotalPaise(
  cart: { pricePaise: number; qty: number }[]
): number {
  return cart.reduce((sum, line) => sum + line.pricePaise * line.qty, 0);
}
