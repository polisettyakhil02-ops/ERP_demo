export function formatCurrency(
  amount = 0,
  options = { decimals: 2, symbol: "₹" },
) {
  const { decimals = 2, symbol = "₹" } = options;

  // Handle null, undefined, or non-numeric values
  const num = parseFloat(amount) || 0;

  // Format using Indian locale (en-IN)
  return (
    symbol +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function formatCurrencyShort(amount = 0) {
  const num = parseFloat(amount) || 0;
  const absNum = Math.abs(num);

  if (absNum >= 10000000) {
    return (
      "₹" +
      (num / 10000000).toLocaleString("en-IN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) +
      "Cr"
    );
  }
  if (absNum >= 100000) {
    return (
      "₹" +
      (num / 100000).toLocaleString("en-IN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) +
      "L"
    );
  }
  if (absNum >= 1000) {
    return (
      "₹" +
      (num / 1000).toLocaleString("en-IN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) +
      "K"
    );
  }

  return (
    "₹" +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export function formatNumber(amount = 0, options = { decimals: 0 }) {
  const { decimals = 0 } = options;
  const num = parseFloat(amount) || 0;

  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
