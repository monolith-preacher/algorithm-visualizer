# Algorithm Lab C library.
#
#   make            build build/avlab (instrumented) and build/avbench (plain -O2)
#   make test       build and run the unit tests with ASan + UBSan
#   make clean

CC      ?= gcc
CSTD    := -std=c17
WARN    := -Wall -Wextra -Wpedantic -Wshadow -Wstrict-prototypes -Werror
INCLUDE := -Iinclude
BUILD   := build

ALGO_SRC := $(wildcard src/sorting/*.c src/searching/*.c src/recursion/*.c \
                       src/stacks/*.c src/queues/*.c src/lists/*.c)
HEADERS  := $(wildcard include/*.h src/*/*.h)

TRACE_OBJ := $(patsubst src/%.c,$(BUILD)/trace/%.o,$(ALGO_SRC)) $(BUILD)/trace/trace/av_trace.o
PLAIN_OBJ := $(patsubst src/%.c,$(BUILD)/plain/%.o,$(ALGO_SRC))
SAN_OBJ   := $(patsubst src/%.c,$(BUILD)/san/%.o,$(ALGO_SRC))

TRACE_FLAGS := $(CSTD) $(WARN) $(INCLUDE) -O1 -DAV_TRACE
PLAIN_FLAGS := $(CSTD) $(WARN) $(INCLUDE) -O2
SAN_FLAGS   := $(CSTD) $(WARN) $(INCLUDE) -O1 -g -fno-omit-frame-pointer \
               -fsanitize=address,undefined -fno-sanitize-recover=all

TESTS := $(patsubst tests/%.c,$(BUILD)/tests/%,$(filter-out tests/test_main.c,$(wildcard tests/test_*.c)))

.PHONY: all test trace-smoke clean
.SECONDARY:

all: $(BUILD)/avlab $(BUILD)/avbench

$(BUILD)/trace/%.o: src/%.c $(HEADERS)
	@mkdir -p $(dir $@)
	$(CC) $(TRACE_FLAGS) -c $< -o $@

$(BUILD)/plain/%.o: src/%.c $(HEADERS)
	@mkdir -p $(dir $@)
	$(CC) $(PLAIN_FLAGS) -c $< -o $@

$(BUILD)/san/%.o: src/%.c $(HEADERS)
	@mkdir -p $(dir $@)
	$(CC) $(SAN_FLAGS) -c $< -o $@

$(BUILD)/avlab: driver/avlab.c $(TRACE_OBJ) $(HEADERS)
	$(CC) $(TRACE_FLAGS) driver/avlab.c $(TRACE_OBJ) -o $@

$(BUILD)/avbench: driver/avbench.c $(PLAIN_OBJ) $(HEADERS)
	$(CC) $(PLAIN_FLAGS) driver/avbench.c $(PLAIN_OBJ) -o $@

# Unit tests link against the uninstrumented sources. malloc is wrapped so
# that tests can inject allocation failures (tests/unit.h).
$(BUILD)/tests/%: tests/%.c tests/unit.h $(SAN_OBJ)
	@mkdir -p $(dir $@)
	$(CC) $(SAN_FLAGS) -Isrc $< $(SAN_OBJ) -Wl,--wrap=malloc -o $@

# Instrumented driver built with sanitizers, exercised by tests/trace_smoke.sh.
$(BUILD)/avlab-san: driver/avlab.c $(ALGO_SRC) src/trace/av_trace.c $(HEADERS)
	@mkdir -p $(dir $@)
	$(CC) $(SAN_FLAGS) -DAV_TRACE driver/avlab.c $(ALGO_SRC) src/trace/av_trace.c -o $@

test: $(TESTS) trace-smoke
	@set -e; for t in $(TESTS); do echo "== $$t"; ASAN_OPTIONS=detect_leaks=1 $$t; done
	@echo "All C unit tests passed."

trace-smoke: $(BUILD)/avlab-san
	@sh tests/trace_smoke.sh $(BUILD)/avlab-san

clean:
	rm -rf $(BUILD)
