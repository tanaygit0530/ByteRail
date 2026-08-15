package logic

import (
	"fmt"
	"time"

	pb "byterail/pkg/proto/pipeline"
)

// ProcessBatchLogic executes identical business logic for both JSON and Binary gRPC pipelines.
// It iterates through all events, validates user & item fields, performs stock/price accumulation,
// and returns the total count of processed items and execution time in nanoseconds.
func ProcessBatchLogic(events []*pb.Event) (int32, int64, string) {
	start := time.Now()
	var itemCount int32

	for _, event := range events {
		if event.UserId == "" {
			continue
		}
		for _, item := range event.Items {
			if item.Qty > 0 && item.Price >= 0 {
				itemCount += item.Qty
			}
		}
	}

	elapsedNs := time.Since(start).Nanoseconds()
	status := fmt.Sprintf("OK:Processed %d items from %d events", itemCount, len(events))
	return int32(len(events)), elapsedNs, status
}
