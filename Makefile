# Atelier 2 - simulateur d'attaques blockchain + tableau de bord
# Sous Windows : mingw32-make <cible>

PYTHON ?= python
CC ?= gcc
CFLAGS ?= -O2 -std=c11
SIM_SRC = core/sim.c core/bc_core.c core/config.c core/metrics.c \
          core/detector.c core/attacks.c core/rng.c
PORT ?= 8000

.PHONY: all sim demos quick experiments dashboard clean clean-results help

all: sim

help:
	@echo "Cibles disponibles :"
	@echo "  make sim            compile le simulateur C (sim.exe)"
	@echo "  make demos          compile les demos de l'atelier 1 (bin/)"
	@echo "  make quick          matrice reduite (18 executions)"
	@echo "  make experiments    matrice complete (108 executions)"
	@echo "  make dashboard      lance le tableau de bord sur 127.0.0.1:$(PORT)"
	@echo "  make clean          supprime les binaires et caches"
	@echo "  make clean-results  supprime les resultats et scenarios generes"

sim:
	$(CC) $(CFLAGS) -o sim.exe $(SIM_SRC) -lm

demos:
	$(CC) $(CFLAGS) -o bin/merkle_tree.exe merkle_tree.c
	$(CC) $(CFLAGS) -o bin/proof_of_work.exe proof_of_work.c
	$(CC) $(CFLAGS) -o bin/proof_of_stake.exe proof_of_stake.c
	$(CC) $(CFLAGS) -o bin/blockchain_core.exe blockchain_core.c

quick: sim
	$(PYTHON) run_experiments.py --quick --clean

experiments: sim
	$(PYTHON) run_experiments.py --clean

dashboard:
	$(PYTHON) -m uvicorn dashboard.app:app --host 127.0.0.1 --port $(PORT)

clean:
	-@rm -f sim.exe
	-@rm -rf __pycache__ dashboard/__pycache__ .pytest_cache

clean-results:
	-@rm -rf results/runs
	-@rm -f results/summaries.csv results/summary.md
	-@rm -rf scenarios/generated
