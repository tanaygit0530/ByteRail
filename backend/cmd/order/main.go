package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"os"

	"google.golang.org/grpc"

	"byterail/internal/logic"
	pb "byterail/pkg/proto/pipeline"
)

type server struct {
	pb.UnimplementedEventPipelineServer
}

func (s *server) ProcessBatch(ctx context.Context, req *pb.BatchRequest) (*pb.BatchResponse, error) {
	processed, ns, status := logic.ProcessBatchLogic(req.Events)
	return &pb.BatchResponse{
		Processed:       processed,
		ProcessingTimeNs: ns,
		Status:          status,
	}, nil
}

func (s *server) ProcessBatchStream(stream pb.EventPipeline_ProcessBatchStreamServer) error {
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		processed, ns, status := logic.ProcessBatchLogic(req.Events)
		if err := stream.Send(&pb.BatchResponse{
			Processed:       processed,
			ProcessingTimeNs: ns,
			Status:          status,
		}); err != nil {
			return err
		}
	}
}

func main() {
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}
	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8081"
	}

	// Start HTTP REST server for baseline JSON path comparison
	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/json/batch", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var req pb.BatchRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			processed, ns, status := logic.ProcessBatchLogic(req.Events)
			resp := pb.BatchResponse{
				Processed:       processed,
				ProcessingTimeNs: ns,
				Status:          status,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		})
		log.Printf("Order Service REST baseline listening on :%s", httpPort)
		if err := http.ListenAndServe(":"+httpPort, mux); err != nil {
			log.Fatalf("REST server error: %v", err)
		}
	}()

	// Start gRPC server
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen on :%s: %v", grpcPort, err)
	}

	s := grpc.NewServer()
	pb.RegisterEventPipelineServer(s, &server{})

	log.Printf("Order Service gRPC listening on :%s", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
