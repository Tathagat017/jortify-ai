import { useContext } from "react";
import { StoreContext } from "../stores/store-context-provider";

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
