import React from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";
import { Modal } from "../shared/Modal";
import { Login } from "./Login";
import { Signup } from "./Signup";

export const AuthModal: React.FC = observer(() => {
  const { uiStore } = useStore();

  return (
    <Modal
      size="md"
      opened={uiStore.authModalOpen}
      onClose={() => uiStore.closeAuthModal()}
      title={
        uiStore.authView === "signup"
          ? "Sign up for Jortify"
          : "Sign in to Jortify"
      }
    >
      {uiStore.authView === "login" && <Login />}
      {uiStore.authView === "signup" && <Signup />}
    </Modal>
  );
});
