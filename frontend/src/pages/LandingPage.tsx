import {
  faArrowRight,
  faComments,
  faLightbulb,
  faLink,
  faRobot,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Group,
  Image,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import React from "react";
import illustration from "../assets/jorify_image.png";

import logo from "../assets/logo.svg";
import { AuthModal } from "../components/auth/AuthModal";
import { useStore } from "../hooks/use-store";

const LandingPage: React.FC = observer(() => {
  const { uiStore } = useStore();

  // Add CSS animations
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 0.7;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.02);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const features = [
    {
      icon: faRobot,
      title: "AI-Powered Writing",
      description:
        "Get intelligent content suggestions, auto-completion, and writing analysis as you type.",
      color: "blue",
    },
    {
      icon: faLink,
      title: "Smart Auto-Linking",
      description:
        "Automatically discover and link related content across your workspace with AI precision.",
      color: "green",
    },
    {
      icon: faComments,
      title: "RAG Chatbot",
      description:
        "Ask questions about your content and get instant answers with source citations.",
      color: "violet",
    },
    {
      icon: faTags,
      title: "Intelligent Tagging",
      description:
        "Auto-generate semantic tags to organize and discover your content effortlessly.",
      color: "orange",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
      }}
    >
      {/* Navbar */}
      <header
        style={{
          borderBottom: "1px solid #e9ecef",
          padding: "1rem 0",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ width: "100%", padding: "0 1rem" }}>
          <Flex
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Group>
              <Image src={logo} alt="Jortify" width={32} height={32} />
              <Title
                order={3}
                style={{ fontWeight: 700, fontSize: 24, color: "#000000" }}
              >
                Jortify
              </Title>
            </Group>
            <Group>
              <Button
                variant="subtle"
                color="dark"
                size="md"
                onClick={() => uiStore.openAuthModal("login")}
              >
                Log in
              </Button>
              <Button
                variant="filled"
                color="dark"
                size="md"
                onClick={() => uiStore.openAuthModal("signup")}
                style={{
                  backgroundColor: "#000000",
                  border: "none",
                }}
              >
                Get Jortify free
              </Button>
            </Group>
          </Flex>
        </div>
      </header>

      {/* Hero Section */}
      <Container
        size="xl"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 1rem",
        }}
      >
        <Stack
          align="center"
          spacing="xl"
          style={{ maxWidth: 800, textAlign: "center" }}
        >
          <Badge
            size="lg"
            variant="outline"
            color="dark"
            style={{
              marginBottom: 16,
              borderColor: "#000000",
              color: "#000000",
            }}
          >
            <FontAwesomeIcon icon={faLightbulb} style={{ marginRight: 8 }} />
            AI-Powered Knowledge Management
          </Badge>

          <Title
            order={1}
            style={{
              fontSize: "3.5rem",
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#000000",
              marginBottom: 16,
            }}
          >
            Think, Write, and Connect
            <br />
            <span style={{ color: "#495057" }}>with AI Intelligence</span>
          </Title>

          <Text
            size="xl"
            style={{
              color: "#6c757d",
              lineHeight: 1.6,
              maxWidth: 600,
              marginBottom: 24,
            }}
          >
            Transform your note-taking with AI-powered suggestions, smart
            linking, and intelligent organization. Your personal knowledge
            assistant that learns and grows with you.
          </Text>
          <Box style={{ marginTop: "2rem", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: "-20px",
                left: "-20px",
                right: "-20px",
                bottom: "-20px",
                background:
                  "linear-gradient(45deg, rgba(0, 123, 255, 0.1), rgba(111, 66, 193, 0.1))",
                borderRadius: "20px",
                filter: "blur(20px)",
                zIndex: 0,
                animation: "pulse 3s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "2rem 2rem 2.5rem 2rem",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "20px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
                backdropFilter: "blur(10px)",
                transition: "all 0.3s ease",
                maxWidth: "900px",
                margin: "0 auto",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-10px)";
                e.currentTarget.style.boxShadow =
                  "0 30px 60px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 20px 40px rgba(0, 0, 0, 0.1)";
              }}
            >
              <div
                style={{
                  position: "relative",
                  marginBottom: "1rem",
                }}
              >
                <Image
                  src={illustration}
                  alt="Jortify AI-Powered Interface"
                  width={850}
                  height={500}
                  fit="contain"
                  style={{
                    borderRadius: "12px",
                    objectFit: "cover",
                    position: "relative",
                    zIndex: 2,
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "2rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 3,
                }}
              >
                <Group spacing="md">
                  <Button
                    color="dark"
                    size="xl"
                    style={{
                      border: "none",
                      padding: "12px 32px",
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "#ffffff",
                      transition: "all 0.3s ease",
                    }}
                    onClick={() => uiStore.openAuthModal("signup")}
                    rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 10px 25px rgba(0, 123, 255, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    Start Writing Smarter
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    color="dark"
                    style={{
                      padding: "12px 32px",
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      borderColor: "#000000",
                      color: "#000000",
                      transition: "all 0.3s ease",
                    }}
                    onClick={() => uiStore.openAuthModal("login")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#000000";
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#000000";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    Watch Demo
                  </Button>
                </Group>
              </div>
            </div>
          </Box>
        </Stack>
      </Container>

      {/* Features Section */}
      <Container size="xl" style={{ padding: "4rem 1rem" }}>
        <Stack align="center" spacing="xl">
          <Title
            order={2}
            align="center"
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "#000000",
              marginBottom: "2rem",
            }}
          >
            Powered by Advanced AI
          </Title>

          <Grid gutter="xl">
            {features.map((feature, index) => (
              <Grid.Col key={index} span={6} md={6} lg={3}>
                <Card
                  shadow="md"
                  padding="xl"
                  radius="lg"
                  style={{
                    height: "100%",
                    background: "white",
                    border: "1px solid #e9ecef",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-8px)";
                    e.currentTarget.style.boxShadow =
                      "0 20px 40px rgba(0, 0, 0, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 6px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  <Stack align="center" spacing="md">
                    <ThemeIcon
                      size={60}
                      radius="xl"
                      variant="gradient"
                      gradient={{
                        from: feature.color,
                        to: `${feature.color}.6`,
                      }}
                    >
                      <FontAwesomeIcon icon={feature.icon} size="lg" />
                    </ThemeIcon>
                    <Title
                      order={4}
                      align="center"
                      style={{ fontWeight: 600, color: "#000000" }}
                    >
                      {feature.title}
                    </Title>
                    <Text
                      size="sm"
                      align="center"
                      style={{ color: "#6c757d", lineHeight: 1.5 }}
                    >
                      {feature.description}
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Container>

      {/* CTA Section */}
      <Box
        style={{
          backgroundColor: "#000000",
          padding: "4rem 1rem",
        }}
      >
        <Container size="lg">
          <Stack align="center" spacing="xl">
            <Title
              order={2}
              align="center"
              style={{
                color: "white",
                fontSize: "2.5rem",
                fontWeight: 700,
              }}
            >
              Ready to supercharge your productivity?
            </Title>
            <Text
              size="lg"
              align="center"
              style={{
                color: "#adb5bd",
                maxWidth: 500,
              }}
            >
              Join thousands of users who are already writing smarter with
              AI-powered assistance.
            </Text>
            <Button
              size="xl"
              variant="white"
              color="dark"
              style={{
                padding: "12px 32px",
                fontSize: "1.1rem",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#000000",
              }}
              onClick={() => uiStore.openAuthModal("signup")}
              rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
            >
              Get Started for Free
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #e9ecef",
          padding: "2rem 0",
          backgroundColor: "white",
        }}
      >
        <div style={{ width: "100%", padding: "0 1rem" }}>
          <Flex
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Flex align="center" gap="xs" justify="flex-start">
              <Image src={logo} alt="Jortify" width={28} height={28} />
              <Text size="lg" weight={600} style={{ color: "#000000" }}>
                Jortify
              </Text>
            </Flex>
            <Group spacing="xl">
              <Text
                size="sm"
                component="a"
                href="#"
                style={{
                  color: "#6c757d",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Privacy Policy
              </Text>
              <Text
                size="sm"
                component="a"
                href="#"
                style={{
                  color: "#6c757d",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Terms & Conditions
              </Text>
              <Text
                size="sm"
                component="a"
                href="#"
                style={{
                  color: "#6c757d",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Contact
              </Text>
            </Group>
          </Flex>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal />
    </div>
  );
});

export default LandingPage;
