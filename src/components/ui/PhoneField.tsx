"use client";

import dynamic from "next/dynamic";

export interface PhoneFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const LazyPhoneField = dynamic<PhoneFieldProps>(
  () => import("./PhoneFieldInner"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[62px] rounded-lg bg-surface-neutral-100/60 animate-pulse" />
    ),
  },
);

export function PhoneField(props: PhoneFieldProps) {
  return <LazyPhoneField {...props} />;
}
