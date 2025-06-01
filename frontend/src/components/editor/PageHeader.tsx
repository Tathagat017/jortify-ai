import React, { useState, useRef } from "react";
import { Box, Text, TextInput, ActionIcon, Image, Modal } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faSmile, faUpload } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";

const PageHeader: React.FC = observer(() => {
  const { pageStore } = useStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPage = pageStore.selectedPage;

  if (!selectedPage) {
    return null;
  }

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTitleValue(selectedPage.title || "");
  };

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== selectedPage.title) {
      await pageStore.updatePage(selectedPage.id, { title: titleValue.trim() });
    }
  };

  const handleTitleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleTitleSubmit();
    } else if (event.key === "Escape") {
      setIsEditingTitle(false);
      setTitleValue(selectedPage.title || "");
    }
  };

  const handleCoverImageAdd = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // TODO: Implement file upload to server
    // For now, create a local URL
    const imageUrl = URL.createObjectURL(file);
    await pageStore.updatePageCover(selectedPage.id, imageUrl);
  };

  const handleIconChange = () => {
    setShowIconPicker(true);
  };

  const handleIconSelect = async (icon: string) => {
    await pageStore.updatePageIcon(selectedPage.id, icon);
    setShowIconPicker(false);
  };

  // Common emoji icons
  const commonIcons = [
    "📝",
    "📚",
    "📊",
    "🎯",
    "💡",
    "📌",
    "🔖",
    "📋",
    "📓",
    "📔",
    "📒",
    "📑",
    "🔍",
    "📎",
    "📐",
    "✏️",
    "📝",
    "📖",
    "📗",
    "📘",
    "📙",
    "📕",
    "📓",
    "📔",
    "📒",
    "📑",
    "🔖",
    "📌",
    "📍",
    "📎",
    "📐",
    "✏️",
    "📝",
    "📖",
    "📗",
    "📘",
    "📙",
    "📕",
    "📓",
    "📔",
    "📒",
    "📑",
    "🔖",
    "📌",
    "📍",
    "📎",
    "📐",
    "✏️",
  ];

  const filteredIcons = commonIcons.filter(
    (icon) => icon.includes(iconSearch) || iconSearch === ""
  );

  return (
    <Box style={{ marginBottom: "2rem" }}>
      {/* Hidden file input for cover image */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Cover Image */}
      {selectedPage.cover_image ? (
        <Box
          style={{
            width: "100%",
            height: "200px",
            borderRadius: "8px",
            overflow: "hidden",
            marginBottom: "1rem",
            position: "relative",
            cursor: "pointer",
          }}
          onClick={handleCoverImageAdd}
        >
          <Image
            src={selectedPage.cover_image}
            alt="Cover"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Box
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0";
            }}
          >
            <ActionIcon variant="filled" size="lg" color="dark">
              <FontAwesomeIcon icon={faUpload} />
            </ActionIcon>
          </Box>
        </Box>
      ) : (
        <Box
          style={{
            width: "100%",
            height: "60px",
            borderRadius: "8px",
            border: "2px dashed #e9ecef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
            cursor: "pointer",
            opacity: 0.6,
            transition: "all 0.2s ease",
          }}
          onClick={handleCoverImageAdd}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f8f9fa";
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.opacity = "0.6";
          }}
        >
          <ActionIcon variant="subtle" size="lg">
            <FontAwesomeIcon icon={faImage} />
          </ActionIcon>
          <Text size="sm" color="dimmed" ml="xs">
            Add cover image
          </Text>
        </Box>
      )}

      {/* Page Icon and Title Section */}
      <Box style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        {/* Page Icon */}
        <Box
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backgroundColor: "#fafafa",
            transition: "all 0.2s ease",
          }}
          onClick={handleIconChange}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0f0f0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#fafafa";
          }}
        >
          {selectedPage.icon ? (
            <Text size="xl">{selectedPage.icon}</Text>
          ) : (
            <FontAwesomeIcon icon={faSmile} size="lg" color="#787774" />
          )}
        </Box>

        {/* Page Title */}
        <Box style={{ flex: 1 }}>
          {isEditingTitle ? (
            <TextInput
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyPress={handleTitleKeyPress}
              size="xl"
              variant="unstyled"
              placeholder="Untitled"
              style={{
                fontSize: "2.5rem",
                fontWeight: 700,
                color: "#37352f",
                lineHeight: 1.2,
              }}
              styles={{
                input: {
                  fontSize: "2.5rem",
                  color: "#37352f",
                  lineHeight: 1.2,
                  cursor: "text",
                  minHeight: "3rem",
                  fontWeight: 700,
                  padding: "4px 0",
                  borderRadius: "4px",
                  transition: "background-color 0.15s ease",
                },
              }}
              autoFocus
            />
          ) : (
            <Text
              size="xl"
              weight={700}
              style={{
                fontSize: "2.5rem",
                color: "#37352f",
                lineHeight: 1.2,
                cursor: "text",
                minHeight: "3rem",
                padding: "4px 0",
                borderRadius: "4px",
                transition: "background-color 0.15s ease",
              }}
              onClick={handleTitleClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {selectedPage.title || "Untitled"}
            </Text>
          )}
        </Box>
      </Box>

      {/* Icon Picker Modal */}
      <Modal
        opened={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        title="Choose an icon"
        size="md"
      >
        <TextInput
          placeholder="Search icons..."
          value={iconSearch}
          onChange={(e) => setIconSearch(e.target.value)}
          mb="md"
        />
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: "8px",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {filteredIcons.map((icon, index) => (
            <Box
              key={index}
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: "4px",
                transition: "background-color 0.2s ease",
              }}
              onClick={() => handleIconSelect(icon)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Text size="xl">{icon}</Text>
            </Box>
          ))}
        </Box>
      </Modal>

      {/* Divider */}
      <Box
        style={{
          width: "100%",
          height: "1px",
          backgroundColor: "#e9ecef",
          margin: "2rem 0 1rem 0",
        }}
      />
    </Box>
  );
});

export default PageHeader;
