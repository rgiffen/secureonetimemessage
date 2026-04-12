import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/index.css";
import { Compose } from "./pages/Compose";
import { LinkCreated } from "./pages/LinkCreated";
import { Retrieve } from "./pages/Retrieve";

declare global {
  interface Window {
    __SECUREDROP_K_LINK__?: string;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Compose />} />
        <Route path="/created" element={<LinkCreated />} />
        <Route path="/m/:token" element={<Retrieve />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
