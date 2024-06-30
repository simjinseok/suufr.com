import { Badge } from "@/components/badge";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      color={
        status === "active" ? "green" : status === "paused" ? "yellow" : "red"
      }
    >
      {status === "active"
        ? "수강중"
        : status === "paused"
          ? "일시정지"
          : "그만둠"}
    </Badge>
  );
}
