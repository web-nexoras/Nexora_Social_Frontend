import React from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="flex gap-0 mt-0 items-start">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 min-w-0 pl-4">{children}</div>
    </div>
  );
}
