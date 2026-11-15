import { Suspense } from "react";
import CatalogView from "@/components/catalog/CatalogView";
import "@/components/catalog/catalog.css";

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogView />
    </Suspense>
  );
}
