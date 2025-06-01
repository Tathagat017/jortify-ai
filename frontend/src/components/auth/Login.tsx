import {
  faGithub,
  faGoogle,
  faLinkedin,
} from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Box,
  Button,
  Divider,
  Group,
  PasswordInput,
  Text,
  TextInput,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../hooks/use-store";

export const Login = observer(() => {
  const { authStore, uiStore } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    authStore.resetError();
    const success = await authStore.signIn(email, password);
    if (success) {
      if (authStore.user) {
        navigate("/dashboard");

        uiStore.closeAuthModal();
      }
    }
  };

  // Only fetch pages if user is logged in

  return (
    <Box>
      <Text size="sm" color="dimmed" mb={24}>
        to continue to Jortify
      </Text>
      <Group grow mb={16} spacing={12}>
        <Button
          variant="default"
          leftIcon={<FontAwesomeIcon icon={faGithub} />}
          disabled
        >
          {/* GitHub */}
        </Button>
        <Button
          variant="default"
          leftIcon={<FontAwesomeIcon icon={faGoogle} />}
          disabled
        >
          {/* Google */}
        </Button>
        <Button
          variant="default"
          leftIcon={<FontAwesomeIcon icon={faLinkedin} />}
          disabled
        >
          {/* LinkedIn */}
        </Button>
      </Group>
      <Divider label="or" labelPosition="center" my={16} />

      <TextInput
        label="Email address"
        placeholder="you@example.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        mb={16}
      />
      <PasswordInput
        label="Password"
        placeholder="Your password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        mb={16}
      />
      <Button fullWidth onClick={handleSubmit} mt={8} mb={8} color="dark">
        Continue
      </Button>

      <Text align="left" size="sm" mt={16}>
        No account?{" "}
        <Button
          variant="subtle"
          size="xs"
          color="dark"
          onClick={() => uiStore.openAuthModal("signup")}
          style={{ padding: 0, height: "auto" }}
        >
          Sign up
        </Button>
      </Text>
    </Box>
  );
});
