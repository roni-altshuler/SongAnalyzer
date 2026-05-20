// Music-streaming dark design system — UI primitives barrel export.
//
// Stream B output. Consumers should import from `@/app/components/ui`.
// All primitives accept a `className` prop merged via `cn()` so styles
// can be extended without forking the component.

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
  type CardVariant,
} from './Card';

export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

export { Badge, type BadgeProps, type BadgeVariant } from './Badge';

export { Meter, type MeterProps } from './Meter';

export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  type TooltipProps,
} from './Tooltip';

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalPortal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from './Modal';

export { Skeleton, type SkeletonProps } from './Skeleton';

export { Toaster, toast } from './Toast';

export { Spectrum, type SpectrumProps } from './Spectrum';
