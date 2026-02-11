import type { TopologyNode } from "@dokploy/server/utils/topology/detect-dependencies";
import { detectDependencies } from "@dokploy/server/utils/topology/detect-dependencies";
import { describe, expect, it } from "vitest";

const makeNode = (
	overrides: Partial<TopologyNode> & { id: string; appName: string },
): TopologyNode => ({
	name: overrides.appName,
	type: "application",
	...overrides,
});

describe("detectDependencies", () => {
	it("returns empty data when no services are provided", () => {
		const result = detectDependencies([], {});
		expect(result.nodes).toEqual([]);
		expect(result.edges).toEqual([]);
	});

	it("returns nodes with no edges when a single service exists", () => {
		const services = [makeNode({ id: "app1", appName: "my-app-abc123" })];
		const result = detectDependencies(services, {});
		expect(result.nodes).toHaveLength(1);
		expect(result.edges).toHaveLength(0);
	});

	it("returns no edges when no env vars reference other services", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
			makeNode({
				id: "db1",
				appName: "postgres-def456",
				type: "postgres",
			}),
		];
		const envVarsMap = {
			app1: "PORT=3000\nNODE_ENV=production",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(0);
	});

	it("detects a postgres reference in DATABASE_URL env var", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
			makeNode({
				id: "db1",
				appName: "postgres-def456",
				type: "postgres",
			}),
		];
		const envVarsMap = {
			app1: "DATABASE_URL=postgres://user:pass@postgres-def456:5432/mydb\nPORT=3000",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(1);
		expect(result.edges[0]).toEqual({
			source: "app1",
			target: "db1",
			label: "DATABASE_URL",
		});
	});

	it("detects multiple database references from a single service", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
			makeNode({
				id: "db1",
				appName: "postgres-def456",
				type: "postgres",
			}),
			makeNode({ id: "cache1", appName: "redis-ghi789", type: "redis" }),
		];
		const envVarsMap = {
			app1: "DATABASE_URL=postgres://user:pass@postgres-def456:5432/mydb\nREDIS_URL=redis://redis-ghi789:6379",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(2);

		const targets = result.edges.map((e) => e.target).sort();
		expect(targets).toEqual(["cache1", "db1"]);
	});

	it("does not match appName as a substring of a longer name", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc" }),
			makeNode({
				id: "db1",
				appName: "postgres-abc",
				type: "postgres",
			}),
			makeNode({
				id: "db2",
				appName: "postgres-abcdef",
				type: "postgres",
			}),
		];
		const envVarsMap = {
			app1: "DATABASE_URL=postgres://user:pass@postgres-abc:5432/mydb",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(1);
		expect(result.edges[0]?.target).toBe("db1");
	});

	it("handles circular references between services", () => {
		const services = [
			makeNode({ id: "app1", appName: "service-a" }),
			makeNode({ id: "app2", appName: "service-b" }),
		];
		const envVarsMap = {
			app1: "BACKEND_URL=http://service-b:8080",
			app2: "FRONTEND_URL=http://service-a:3000",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(2);

		const edgePairs = result.edges.map((e) => `${e.source}->${e.target}`);
		expect(edgePairs).toContain("app1->app2");
		expect(edgePairs).toContain("app2->app1");
	});

	it("deduplicates edges with the same source and target", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
			makeNode({
				id: "db1",
				appName: "postgres-def456",
				type: "postgres",
			}),
		];
		const envVarsMap = {
			// The appName appears in two different env vars
			app1: "DATABASE_URL=postgres://user:pass@postgres-def456:5432/mydb\nDB_HOST=postgres-def456",
		};
		const result = detectDependencies(services, envVarsMap);
		// Should still be 1 edge, deduplicated by source->target
		expect(result.edges).toHaveLength(1);
	});

	it("does not create a self-referencing edge", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
		];
		const envVarsMap = {
			app1: "SELF_URL=http://my-app-abc123:3000",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(0);
	});

	it("handles empty env vars gracefully", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app-abc123" }),
			makeNode({
				id: "db1",
				appName: "postgres-def456",
				type: "postgres",
			}),
		];
		const envVarsMap = {
			app1: "",
			db1: "",
		};
		const result = detectDependencies(services, envVarsMap);
		expect(result.edges).toHaveLength(0);
	});

	it("returns all services as nodes regardless of connections", () => {
		const services = [
			makeNode({ id: "app1", appName: "my-app", type: "application" }),
			makeNode({ id: "db1", appName: "my-pg", type: "postgres" }),
			makeNode({ id: "db2", appName: "my-redis", type: "redis" }),
		];
		const result = detectDependencies(services, {});
		expect(result.nodes).toHaveLength(3);
		expect(result.nodes.map((n) => n.id)).toEqual(["app1", "db1", "db2"]);
	});

	describe("compose dependencies", () => {
		it("parses depends_on in array format", () => {
			const services = [
				makeNode({
					id: "comp1",
					appName: "my-compose",
					type: "compose",
				}),
				makeNode({
					id: "db1",
					appName: "postgres-svc",
					type: "postgres",
				}),
			];
			const composeFiles = {
				comp1: `
version: "3.8"
services:
  web:
    image: nginx:latest
    depends_on:
      - postgres-svc
`,
			};
			const result = detectDependencies(services, {}, composeFiles);
			expect(result.edges).toHaveLength(1);
			expect(result.edges[0]).toEqual({
				source: "comp1",
				target: "db1",
				label: "depends_on",
			});
		});

		it("parses depends_on in object format", () => {
			const services = [
				makeNode({
					id: "comp1",
					appName: "my-compose",
					type: "compose",
				}),
				makeNode({
					id: "db1",
					appName: "redis-cache",
					type: "redis",
				}),
			];
			const composeFiles = {
				comp1: `
version: "3.8"
services:
  web:
    image: nginx:latest
    depends_on:
      redis-cache:
        condition: service_healthy
`,
			};
			const result = detectDependencies(services, {}, composeFiles);
			expect(result.edges).toHaveLength(1);
			expect(result.edges[0]?.target).toBe("db1");
		});

		it("parses links from compose files", () => {
			const services = [
				makeNode({
					id: "comp1",
					appName: "my-compose",
					type: "compose",
				}),
				makeNode({
					id: "db1",
					appName: "mysql-db",
					type: "mysql",
				}),
			];
			const composeFiles = {
				comp1: `
version: "3.8"
services:
  web:
    image: nginx:latest
    links:
      - mysql-db:database
`,
			};
			const result = detectDependencies(services, {}, composeFiles);
			expect(result.edges).toHaveLength(1);
			expect(result.edges[0]?.target).toBe("db1");
		});

		it("ignores compose files that reference unknown services", () => {
			const services = [
				makeNode({
					id: "comp1",
					appName: "my-compose",
					type: "compose",
				}),
			];
			const composeFiles = {
				comp1: `
version: "3.8"
services:
  web:
    image: nginx:latest
    depends_on:
      - unknown-service
`,
			};
			const result = detectDependencies(services, {}, composeFiles);
			expect(result.edges).toHaveLength(0);
		});

		it("does not create duplicate edges from env vars and compose deps", () => {
			const services = [
				makeNode({
					id: "comp1",
					appName: "my-compose",
					type: "compose",
				}),
				makeNode({
					id: "db1",
					appName: "postgres-svc",
					type: "postgres",
				}),
			];
			const envVarsMap = {
				comp1: "DATABASE_URL=postgres://user:pass@postgres-svc:5432/mydb",
			};
			const composeFiles = {
				comp1: `
version: "3.8"
services:
  web:
    image: nginx:latest
    depends_on:
      - postgres-svc
`,
			};
			const result = detectDependencies(
				services,
				envVarsMap,
				composeFiles,
			);
			// Env var detection finds it first, compose skips due to dedup
			expect(result.edges).toHaveLength(1);
		});
	});
});
