"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface NavContextType {
  activeNav: string;
  setActiveNav: (nav: string) => void;
}

const NavContext = createContext<NavContextType>({
  activeNav: "/",
  setActiveNav: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined" || !window.billflow?.onNavigate) return;
    const unsubscribe = window.billflow.onNavigate((route) => {
      setActiveNav(route);
      router.push(route);
    });
    return () => {
      unsubscribe();
    };
  }, [router]);

  return (
    <NavContext.Provider value={{ activeNav, setActiveNav }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}
