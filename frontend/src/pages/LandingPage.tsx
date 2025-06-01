import React from "react";
import {
  Button,
  Container,
  Group,
  Text,
  Title,
  Image,
  Center,
  Flex,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun } from "@fortawesome/free-solid-svg-icons";
import logo from "../assets/logo.svg";
import illustration from "../assets/reading-light.webp";
import { observer } from "mobx-react-lite";
import { useStore } from "../hooks/use-store";
import { AuthModal } from "../components/auth/AuthModal";

const LandingPage: React.FC = observer(() => {
  const { uiStore } = useStore();

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Navbar */}
      <header style={{ borderBottom: "1px solid #eee", padding: "0.5rem 0" }}>
        <Flex
          style={{
            width: "100%",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Group>
            <Image src={logo} alt="Jortify" width={32} height={32} />
            <Title order={3} style={{ fontWeight: 600, fontSize: 24 }}>
              Jortify
            </Title>
          </Group>
          <Group>
            <Button
              variant="subtle"
              color="dark"
              onClick={() => uiStore.openAuthModal("login")}
            >
              Log in
            </Button>
            <Button
              variant="filled"
              color="dark"
              onClick={() => uiStore.openAuthModal("signup")}
            >
              Get Jortify free
            </Button>
            <Button
              variant="default"
              style={{ borderRadius: "50%", width: 36, height: 36, padding: 0 }}
            >
              <FontAwesomeIcon icon={faSun} size="lg" />
            </Button>
          </Group>
        </Flex>
      </header>

      {/* Hero Section */}
      <Container
        size="lg"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Title
          order={2}
          align="center"
          style={{ marginTop: 40, marginBottom: 16 }}
        >
          better, faster work happens.
        </Title>
        <Button
          size="md"
          style={{ marginBottom: 32 }}
          color="dark"
          onClick={() => uiStore.openAuthModal("signup")}
        >
          Get Jortify free
        </Button>
        <Center>
          <Image
            src={illustration}
            alt="Landing Illustration"
            width={600}
            fit="contain"
          />
        </Center>
      </Container>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #eee",
          padding: "1rem 0",
          marginTop: "auto",
        }}
      >
        <Container
          size="lg"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Group>
            <Image src={logo} alt="Jortify" width={24} height={24} />
            <Text size="md" weight={500}>
              Jortify
            </Text>
          </Group>
          <Group>
            <Text
              size="sm"
              component="a"
              href="#"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Privacy Policy
            </Text>
            <Text
              size="sm"
              component="a"
              href="#"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Terms & Conditions
            </Text>
          </Group>
        </Container>
      </footer>

      {/* Auth Modal */}
      <AuthModal />
    </div>
  );
});

export default LandingPage;
