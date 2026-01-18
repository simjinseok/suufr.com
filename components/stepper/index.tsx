'use client';

import * as React from 'react';

interface Step {
  label: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex items-center gap-2">
            <div
              className={`
                flex items-center justify-center size-6 rounded-full text-xs font-medium transition-colors
                ${index < currentStep
                  ? 'bg-accent text-white'
                  : index === currentStep
                    ? 'bg-accent text-white'
                    : 'bg-default-200 text-default-500'
                }
              `}
            >
              {index < currentStep ? (
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`text-sm ${
                index <= currentStep ? 'text-foreground font-medium' : 'text-default-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-px grow min-w-4 ${
                index < currentStep ? 'bg-accent' : 'bg-default-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
