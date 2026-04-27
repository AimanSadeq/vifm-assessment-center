"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

export type CompetencySelection = {
  competencyId: string;
  weight: number | null;
};

export type MatrixEntry = {
  exerciseId: string;
  competencyId: string;
};

export type WizardState = {
  currentStep: number;
  // Step 1
  organizationId: string;
  engagementName: string;
  targetRole: string;
  startDate: string;
  endDate: string;
  assessmentType: string;
  normGroup: string;
  // Step 2
  selectedCompetencies: CompetencySelection[];
  // Step 3
  selectedExerciseIds: string[];
  // Step 4
  matrix: MatrixEntry[];
  // Submission
  isSubmitting: boolean;
};

type Action =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_BASIC_INFO"; field: string; value: string }
  | { type: "SET_COMPETENCIES"; competencies: CompetencySelection[] }
  | { type: "TOGGLE_COMPETENCY"; competencyId: string }
  | { type: "TOGGLE_DOMAIN"; competencyIds: string[]; selectAll: boolean }
  | { type: "SET_COMPETENCY_WEIGHT"; competencyId: string; weight: number | null }
  | { type: "SET_EXERCISES"; exerciseIds: string[] }
  | { type: "TOGGLE_EXERCISE"; exerciseId: string }
  | { type: "SET_MATRIX"; matrix: MatrixEntry[] }
  | { type: "TOGGLE_MATRIX_CELL"; exerciseId: string; competencyId: string }
  | { type: "SET_SUBMITTING"; isSubmitting: boolean };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };

    case "SET_BASIC_INFO":
      return { ...state, [action.field]: action.value };

    case "SET_COMPETENCIES":
      return { ...state, selectedCompetencies: action.competencies };

    case "TOGGLE_COMPETENCY": {
      const exists = state.selectedCompetencies.find(
        (c) => c.competencyId === action.competencyId
      );
      if (exists) {
        return {
          ...state,
          selectedCompetencies: state.selectedCompetencies.filter(
            (c) => c.competencyId !== action.competencyId
          ),
          // Also remove from matrix
          matrix: state.matrix.filter(
            (m) => m.competencyId !== action.competencyId
          ),
        };
      }
      return {
        ...state,
        selectedCompetencies: [
          ...state.selectedCompetencies,
          { competencyId: action.competencyId, weight: null },
        ],
      };
    }

    case "TOGGLE_DOMAIN": {
      if (action.selectAll) {
        // Add all that aren't already selected
        const existingIds = new Set(state.selectedCompetencies.map((c) => c.competencyId));
        const toAdd = action.competencyIds.filter((id) => !existingIds.has(id));
        return {
          ...state,
          selectedCompetencies: [
            ...state.selectedCompetencies,
            ...toAdd.map((id) => ({ competencyId: id, weight: null })),
          ],
        };
      } else {
        // Remove all in this domain
        const idsToRemove = new Set(action.competencyIds);
        return {
          ...state,
          selectedCompetencies: state.selectedCompetencies.filter((c) => !idsToRemove.has(c.competencyId)),
          matrix: state.matrix.filter((m) => !idsToRemove.has(m.competencyId)),
        };
      }
    }

    case "SET_COMPETENCY_WEIGHT":
      return {
        ...state,
        selectedCompetencies: state.selectedCompetencies.map((c) =>
          c.competencyId === action.competencyId
            ? { ...c, weight: action.weight }
            : c
        ),
      };

    case "SET_EXERCISES":
      return { ...state, selectedExerciseIds: action.exerciseIds };

    case "TOGGLE_EXERCISE": {
      const has = state.selectedExerciseIds.includes(action.exerciseId);
      if (has) {
        return {
          ...state,
          selectedExerciseIds: state.selectedExerciseIds.filter(
            (id) => id !== action.exerciseId
          ),
          // Also remove from matrix
          matrix: state.matrix.filter(
            (m) => m.exerciseId !== action.exerciseId
          ),
        };
      }
      return {
        ...state,
        selectedExerciseIds: [...state.selectedExerciseIds, action.exerciseId],
      };
    }

    case "SET_MATRIX":
      return { ...state, matrix: action.matrix };

    case "TOGGLE_MATRIX_CELL": {
      const exists = state.matrix.find(
        (m) =>
          m.exerciseId === action.exerciseId &&
          m.competencyId === action.competencyId
      );
      if (exists) {
        return {
          ...state,
          matrix: state.matrix.filter(
            (m) =>
              !(
                m.exerciseId === action.exerciseId &&
                m.competencyId === action.competencyId
              )
          ),
        };
      }
      return {
        ...state,
        matrix: [
          ...state.matrix,
          {
            exerciseId: action.exerciseId,
            competencyId: action.competencyId,
          },
        ],
      };
    }

    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.isSubmitting };

    default:
      return state;
  }
}

const initialState: WizardState = {
  currentStep: 1,
  organizationId: "",
  engagementName: "",
  targetRole: "",
  startDate: "",
  endDate: "",
  assessmentType: "",
  normGroup: "",
  selectedCompetencies: [],
  selectedExerciseIds: [],
  matrix: [],
  isSubmitting: false,
};

const WizardContext = createContext<WizardState>(initialState);
const WizardDispatchContext = createContext<Dispatch<Action>>(() => {});

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <WizardContext.Provider value={state}>
      <WizardDispatchContext.Provider value={dispatch}>
        {children}
      </WizardDispatchContext.Provider>
    </WizardContext.Provider>
  );
}

export function useWizard() {
  return useContext(WizardContext);
}

export function useWizardDispatch() {
  return useContext(WizardDispatchContext);
}
