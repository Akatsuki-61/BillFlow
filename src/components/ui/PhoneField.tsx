"use client";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { useId, useState } from "react";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries()
  .map((country) => ({
    country,
    name: regionNames.of(country) ?? country,
    code: getCountryCallingCode(country),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function PhoneField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const parsed = parsePhoneNumberFromString(value);
  const [preferred, setPreferred] = useState<CountryCode | "">("");
  const region = preferred || parsed?.country || "";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <select
          className="ui-field w-full"
          aria-label={`${label} country code`}
          value={region}
          onChange={(event) => {
            const next = event.target.value as CountryCode | "";
            setPreferred(next);
            if (!next) return;
            const code = getCountryCallingCode(next);
            const national =
              parsed?.nationalNumber ||
              value.replace(/\D/g, "").replace(/^0+/, "");
            if (national) onChange(`+${code}${national}`);
          }}
        >
          <option value="">Country code</option>
          {countries.map(({ country, name, code }) => (
            <option key={country} value={country}>
              {name} (+{code})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          className="ui-field w-full"
          value={value}
          maxLength={40}
          autoComplete="tel"
          placeholder="+94 77 123 4567"
          onChange={(event) => {
            const next = event.target.value;
            if (next.startsWith("+")) {
              const selected = parsePhoneNumberFromString(next)?.country;
              if (selected) setPreferred(selected);
            }
            onChange(next);
          }}
          onBlur={() => {
            const phone = parsePhoneNumberFromString(
              value,
              region || undefined,
            );
            if (phone?.isPossible()) onChange(phone.number);
            else if (
              region &&
              value.trim() === `+${getCountryCallingCode(region)}`
            )
              onChange("");
          }}
        />
      </div>
    </div>
  );
}
