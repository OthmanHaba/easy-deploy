import { parse } from "dotenv";

export interface TopologyNode {
	id: string;
	appName: string;
	name: string;
	type:
		| "application"
		| "postgres"
		| "mysql"
		| "mariadb"
		| "mongo"
		| "redis"
		| "compose";
	status?: "idle" | "running" | "done" | "error";
}

export interface TopologyEdge {
	source: string;
	target: string;
	label?: string;
}

export interface TopologyData {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
}

const findEnvKeyContaining = (
	envString: string,
	appName: string,
): string | undefined => {
	const vars = parse(envString);
	for (const [key, value] of Object.entries(vars)) {
		if (value && containsAppName(value, appName)) {
			return key;
		}
	}
	return undefined;
};

const containsAppName = (value: string, appName: string): boolean => {
	const escaped = appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`(?:^|[^a-zA-Z0-9_-])${escaped}(?:[^a-zA-Z0-9_-]|$)`);
	return pattern.test(value);
};

export const detectDependencies = (
	services: TopologyNode[],
	envVarsMap: Record<string, string>,
	composeFiles?: Record<string, string>,
): TopologyData => {
	const edges: TopologyEdge[] = [];
	const appNameToId = new Map<string, string>();
	const seen = new Set<string>();

	for (const service of services) {
		appNameToId.set(service.appName, service.id);
	}

	// 1. Scan environment variables for appName references
	for (const service of services) {
		const envString = envVarsMap[service.id] || "";
		if (!envString) continue;

		for (const [otherAppName, otherId] of appNameToId) {
			if (otherAppName === service.appName) continue;

			if (containsAppName(envString, otherAppName)) {
				const label = findEnvKeyContaining(envString, otherAppName);
				const edgeKey = `${service.id}->${otherId}`;
				if (!seen.has(edgeKey)) {
					edges.push({ source: service.id, target: otherId, label });
					seen.add(edgeKey);
				}
			}
		}
	}

	// 2. Parse compose depends_on and links
	if (composeFiles) {
		for (const service of services) {
			if (service.type !== "compose") continue;
			const yamlContent = composeFiles[service.id];
			if (!yamlContent) continue;

			try {
				const depNames = parseComposeDependencies(yamlContent);
				for (const depName of depNames) {
					const targetId = appNameToId.get(depName);
					if (targetId && targetId !== service.id) {
						const edgeKey = `${service.id}->${targetId}`;
						if (!seen.has(edgeKey)) {
							edges.push({
								source: service.id,
								target: targetId,
								label: "depends_on",
							});
							seen.add(edgeKey);
						}
					}
				}
			} catch {
				// Skip unparseable compose files
			}
		}
	}

	return { nodes: services, edges };
};

const parseComposeDependencies = (yamlContent: string): string[] => {
	const deps: string[] = [];
	const lines = yamlContent.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trimStart();

		// Match depends_on: or links:
		if (trimmed === "depends_on:" || trimmed === "links:") {
			const baseIndent = line.length - trimmed.length;
			// Read subsequent lines that are more indented
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j];
				if (!nextLine || nextLine.trim() === "") continue;
				const nextIndent =
					nextLine.length - nextLine.trimStart().length;
				if (nextIndent <= baseIndent) break;

				const nextTrimmed = nextLine.trimStart();
				// Array format: "- service_name"
				if (nextTrimmed.startsWith("- ")) {
					const value = nextTrimmed.slice(2).trim();
					// links can be "service:alias"
					const serviceName = value.split(":")[0];
					if (serviceName) deps.push(serviceName);
				}
				// Object format: "service_name:" (direct child, one level deeper)
				else if (
					nextIndent === baseIndent + 2 ||
					nextIndent === baseIndent + 4
				) {
					const keyMatch = nextTrimmed.match(
						/^([a-zA-Z0-9_-]+):\s*/,
					);
					if (keyMatch) {
						deps.push(keyMatch[1]);
					}
				}
			}
		}
	}

	return [...new Set(deps)];
};
