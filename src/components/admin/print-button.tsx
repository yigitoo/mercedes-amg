"use client";

import { PrinterIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <PrinterIcon size={18} aria-hidden />
      Yazdır
    </Button>
  );
}
