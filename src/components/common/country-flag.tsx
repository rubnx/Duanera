import { cn } from "@/lib/utils";
import { normalizeCountryFlagCode } from "@/trade/country-codes";

type CountryFlagProps = {
  className?: string;
  countryCode?: string | null;
  countryName?: string | null;
};

function CountryFlag({ className, countryCode, countryName }: CountryFlagProps) {
  const flagCode = normalizeCountryFlagCode(countryCode, countryName);

  if (!flagCode) {
    return null;
  }

  const accessibleName = countryName
    ? `Bandera de ${countryName}`
    : `Bandera ${flagCode.toUpperCase()}`;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "fi",
        `fi-${flagCode}`,
        "inline-block shrink-0 rounded-[1px] text-[0.95em] shadow-[0_0_0_1px_rgb(15_23_42/8%)]",
        className,
      )}
      title={accessibleName}
    />
  );
}

export { CountryFlag };
