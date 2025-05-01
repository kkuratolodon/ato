#!/bin/bash
# Script to analyze k6 stress test results for degradation patterns

# Check if log file was provided as argument, otherwise use default
LOG_FILE=${1:-"upload-po-stress-test.log"}

echo "Extracting degradation analysis from test results..."

# Count timeout errors first without modifying the file
TIMEOUT_COUNT=$(grep -c "Status 504" $LOG_FILE || echo "0")
echo "Total timeout errors (504): $TIMEOUT_COUNT"
echo "$TIMEOUT_COUNT" > timeout_count.txt

# Extract sections of the log without sed replacements
SUMMARY=$(grep -A 20 "=== Purchase Order Upload Stress Test Summary ===" $LOG_FILE || echo "Tidak dapat menemukan ringkasan hasil")
DEGRADATION_ANALYSIS=$(grep -A 50 "=== Analisis Degradasi Sistem ===" $LOG_FILE || echo "Tidak dapat menemukan analisis degradasi")
PERFORMANCE_TABLE=$(grep -A 15 "Performa Per Tahap Load Testing:" $LOG_FILE || echo "Tidak dapat menemukan tabel performa")
CONCLUSION=$(grep -A 10 "=== Ringkasan Ketahanan Sistem ===" $LOG_FILE || echo "Tidak dapat menemukan kesimpulan analisis")

# Save to separate files for easier reference
echo "$SUMMARY" > summary.txt
echo "$DEGRADATION_ANALYSIS" > degradation_analysis.txt
echo "$PERFORMANCE_TABLE" > performance_table.txt
echo "$CONCLUSION" > conclusion.txt

# Create fallback table directly - bypass the complex sed command
echo "Creating performance summary directly from timeouts..."
echo "## Performance Summary" > performance_summary.md
echo "| Stage | VUs | Requests | Error Rate | Failed Requests (504) | Latency p95 (ms) | Status |" >> performance_summary.md
echo "| ----- | --- | -------- | ---------- | -------------------- | --------------- | ------ |" >> performance_summary.md

# Define VU targets for each stage
declare -a VU_TARGETS=(10 15 18 20 30 40 60 80 100 300)

# Create simple table directly from log data without complex regex
for i in {0..9}; do
  # Count successful and failed requests per stage - ensure numbers with || echo 0
  STAGE_REQUESTS=$(grep -c "Request berhasil.*Stage: $i" $LOG_FILE || echo 0)
  STAGE_FAILURES=$(grep -c "Request gagal.*Stage: $i" $LOG_FILE || echo 0)
  STAGE_TIMEOUTS=$(grep -c "Status 504.*Stage: $i" $LOG_FILE || echo 0)
  
  # Calculate total requests - ensure they're treated as integers
  TOTAL_REQUESTS=$((STAGE_REQUESTS + STAGE_FAILURES))
  
  # Calculate error rate
  if [ "$TOTAL_REQUESTS" -gt 0 ]; then
    # Use bc for floating point calculation
    ERROR_RATE=$(echo "scale=2; $STAGE_FAILURES * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0.00")
    ERROR_RATE="${ERROR_RATE}%"
  else
    ERROR_RATE="0.00%"
  fi
  
  # Determine status based on timeouts
  if [ "$STAGE_TIMEOUTS" -gt 0 ]; then
    STATUS="⚠️ Timeouts Detected"
  else
    STATUS="Normal"
  fi
  
  # Get latency from performance table if available
  LATENCY_P95=$(grep -E "^$i \|.*\|.*\|.*\|.*\|.*\|" performance_table.txt | awk -F'|' '{print $6}' | tr -d ' ' || echo "N/A")
  
  # Create line for markdown table
  echo "| $i | ${VU_TARGETS[$i]} | $TOTAL_REQUESTS | $ERROR_RATE | $STAGE_TIMEOUTS | $LATENCY_P95 | $STATUS |" >> performance_summary.md
  
  # Save raw data for debugging
  echo "Stage $i: Requests=$STAGE_REQUESTS, Failures=$STAGE_FAILURES, Timeouts=$STAGE_TIMEOUTS" >> raw_stats.txt
done

echo "=== Final Analysis ==="
TOTAL_REQUESTS=$(grep -c "Request berhasil\|Request gagal" $LOG_FILE || echo 0)
TOTAL_FAILURES=$(grep -c "Request gagal" $LOG_FILE || echo 0)
TOTAL_TIMEOUTS=$(grep -c "Status 504" $LOG_FILE || echo 0)

echo "Total Requests: $TOTAL_REQUESTS"
echo "Total Failures: $TOTAL_FAILURES"
echo "Total Timeouts: $TOTAL_TIMEOUTS"

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  FAILURE_RATE=$(echo "scale=2; $TOTAL_FAILURES * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0.00")
  echo "Overall Failure Rate: ${FAILURE_RATE}%"
else
  echo "Overall Failure Rate: 0.00% (no requests found)"
fi

echo "Analysis complete. See performance_summary.md for detailed results."