import {
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircuitBoard, GlobeIcon } from "lucide-react";
import { memo } from "react";

export interface ServiceNodeData {
	label: string;
	serviceType:
		| "application"
		| "postgres"
		| "mysql"
		| "mariadb"
		| "mongo"
		| "redis"
		| "compose";
	status?: "idle" | "running" | "done" | "error";
	serviceId: string;
	[key: string]: unknown;
}

const statusColors: Record<string, string> = {
	idle: "bg-muted-foreground",
	running: "bg-yellow-500",
	done: "bg-green-500",
	error: "bg-destructive",
};

const ServiceIcon = ({
	type,
}: {
	type: ServiceNodeData["serviceType"];
}) => {
	switch (type) {
		case "postgres":
			return <PostgresqlIcon className="size-5" />;
		case "redis":
			return <RedisIcon className="size-5" />;
		case "mariadb":
			return <MariadbIcon className="size-5" />;
		case "mongo":
			return <MongodbIcon className="size-5" />;
		case "mysql":
			return <MysqlIcon className="size-5" />;
		case "compose":
			return <CircuitBoard className="size-5" />;
		case "application":
		default:
			return <GlobeIcon className="size-5" />;
	}
};

export const ServiceNode = memo(
	({ data }: NodeProps & { data: ServiceNodeData }) => {
		const nodeData = data as ServiceNodeData;
		return (
			<div className="rounded-lg border bg-card text-card-foreground shadow-sm px-4 py-3 min-w-[180px] cursor-pointer hover:bg-accent transition-colors">
				<Handle
					type="target"
					position={Position.Top}
					className="!bg-muted-foreground !w-2 !h-2"
				/>
				<div className="flex items-center gap-3">
					<div className="text-muted-foreground">
						<ServiceIcon type={nodeData.serviceType} />
					</div>
					<div className="flex flex-col gap-1 min-w-0">
						<span className="text-sm font-medium leading-none truncate">
							{nodeData.label}
						</span>
						<span className="text-xs text-muted-foreground capitalize">
							{nodeData.serviceType}
						</span>
					</div>
					<div
						className={cn(
							"size-2.5 rounded-full ml-auto shrink-0",
							statusColors[nodeData.status || "idle"] ||
								statusColors.idle,
						)}
					/>
				</div>
				<Handle
					type="source"
					position={Position.Bottom}
					className="!bg-muted-foreground !w-2 !h-2"
				/>
			</div>
		);
	},
);

ServiceNode.displayName = "ServiceNode";
