import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";
import {
  TextInput,
  PasswordInput,
  Button,
  Group,
  Divider,
  Text,
  Box,
  Modal,
  Stack,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faGoogle,
  faLinkedin,
} from "@fortawesome/free-brands-svg-icons";
import { faEnvelope, faCheckCircle } from "@fortawesome/free-solid-svg-icons";

export const Signup = observer(() => {
  const { authStore, uiStore } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    authStore.resetError();

    const previousError = authStore.error;
    await authStore.signUp(email, password);

    // Check if signup was successful (no new error and no existing error)
    if (!authStore.error && !previousError) {
      console.log(
        "✅ STEP: Signup successful - showing email confirmation modal"
      );

      // Show confirmation modal
      setShowConfirmationModal(true);

      // Also show notification as backup
      notifications.show({
        id: "email-confirmation",
        title: "Check your email",
        message:
          "We've sent you a confirmation link. Please check your email and click the link to verify your account.",
        color: "blue",
        icon: <FontAwesomeIcon icon={faEnvelope} />,
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    // Close the auth modal
    uiStore.closeAuthModal();
  };

  return (
    <>
      <Box h={"100%"}>
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
        <form onSubmit={handleSubmit}>
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
          <Button fullWidth type="submit" mt={8} mb={8} color="dark">
            Continue
          </Button>
        </form>
        <Text align="left" size="sm" mt={16}>
          Have an account?{" "}
          <Button
            variant="subtle"
            size="xs"
            color="dark"
            onClick={() => uiStore.openAuthModal("login")}
            style={{ padding: 0, height: "auto" }}
          >
            Sign in
          </Button>
        </Text>
      </Box>

      {/* Email Confirmation Modal */}
      <Modal
        opened={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        title="Please Confirm Your Email"
        centered
        size="sm"
        styles={{
          content: {
            backgroundColor: "#fff",
            border: "2px solid #000",
          },
          header: {
            backgroundColor: "#fff",
            borderBottom: "1px solid #e0e0e0",
          },
        }}
      >
        <Stack align="center" spacing="lg" p="md">
          <ThemeIcon size={80} radius="xl" color="green" variant="light">
            <FontAwesomeIcon icon={faCheckCircle} size="2x" />
          </ThemeIcon>

          <Text size="lg" weight={600} align="center">
            Account Created Successfully!
          </Text>

          <Text size="sm" color="dimmed" align="center">
            We've sent a confirmation link to:
          </Text>

          <Text size="md" weight={500} align="center" color="blue">
            {email}
          </Text>

          <Text size="sm" color="dimmed" align="center">
            Please check your email and click the confirmation link to activate
            your account.
          </Text>

          <Button
            fullWidth
            color="dark"
            onClick={handleCloseConfirmationModal}
            mt="md"
          >
            Got it!
          </Button>
        </Stack>
      </Modal>
    </>
  );
});
