"use client";

import React, { createContext, useContext, useState } from "react";

interface NavContextType {
  activeNav: string;
  setActiveNav: (nav: string) => void;
}

const NavContext = createContext<NavContextType>({
  activeNav: "invoices",
  setActiveNav: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [activeNav, setActiveNav] = useState("invoices");

  return (
    <NavContext.Provider value={{ activeNav, setActiveNav }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}
