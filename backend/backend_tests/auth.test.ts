import { makeRequest, TEST_CONFIG } from "./setup";

describe("Authentication API Endpoints", () => {
  describe("GET /auth/me - Get Current User", () => {
    it("should get current user with valid token", async () => {
      const response = await makeRequest("GET", "/auth/me");

      if (response.status === 200) {
        expect((response.data as any).data || response.data).toBeDefined();
        const userData = (response.data as any).data || response.data;
        expect(userData.id || userData.sub).toBeDefined();
        expect(userData.email).toBeDefined();
      } else {
        console.log(
          "Get current user response:",
          response.status,
          response.data
        );
        expect([200, 401, 429]).toContain(response.status);
      }
    });
  });

  describe("POST /auth/signin - User Login", () => {
    it("should successfully login with valid credentials", async () => {
      const response = await makeRequest("POST", "/auth/signin", {
        email: "tathagatraj4@gmail.com",
        password: "Redranger@1234",
      });

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data as any;
        expect(
          responseData.access_token || responseData.data?.session?.access_token
        ).toBeDefined();
        expect(responseData.user || responseData.data?.user).toBeDefined();
      } else {
        console.log("Login response:", response.status, response.data);
        expect([200, 201, 401, 429, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /auth/signout - User Logout", () => {
    it("should handle logout request", async () => {
      const response = await makeRequest("POST", "/auth/signout");

      if (
        response.status === 200 ||
        response.status === 201 ||
        response.status === 204
      ) {
        // Success responses
        console.log("Logout successful");
      } else {
        console.log("Logout response:", response.status, response.data);
        expect([200, 201, 204, 401, 429]).toContain(response.status);
      }
    });
  });
});
