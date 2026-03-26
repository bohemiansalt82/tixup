import { Button } from './components/Button';

/**
 * 버튼 컴포넌트의 가이드용 데모 앱 컴포넌트입니다.
 * XL, LG 사이즈별 변형과 아이콘 조합을 보여줍니다.
 */
export default function App() {
  return (
    <div className="size-full flex items-center justify-center bg-white p-8">
      <div className="w-full max-w-[1200px] space-y-8">
        {/* XL Buttons - Plain */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">XL Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button size="xl">XL Font</Button>
            <Button size="xl" variant="hover">XL Font</Button>
            <Button size="xl" variant="focused-dark">XL Font</Button>
            <Button size="xl" variant="focused-light">XL Font</Button>
            <Button size="xl" variant="disabled">XL Font</Button>
          </div>
        </div>

        {/* XL Buttons - With Left Icon */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">XL with Left Icon</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="xl" iconPosition="left">XL Font</Button>
            <Button size="xl" iconPosition="left" variant="hover">XL Font</Button>
            <Button size="xl" iconPosition="left" variant="focused-dark">XL Font</Button>
            <Button size="xl" iconPosition="left" variant="focused-light">XL Font</Button>
            <Button size="xl" iconPosition="left" variant="disabled">XL Font</Button>
          </div>
        </div>

        {/* XL Buttons - With Right Icon */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">XL with Right Icon</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="xl" iconPosition="right">XL Font</Button>
            <Button size="xl" iconPosition="right" variant="hover">XL Font</Button>
            <Button size="xl" iconPosition="right" variant="focused-dark">XL Font</Button>
            <Button size="xl" iconPosition="right" variant="focused-light">XL Font</Button>
            <Button size="xl" iconPosition="right" variant="disabled">XL Font</Button>
          </div>
        </div>

        {/* XL Buttons - Icon Only */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">XL Icon Only</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="xl" iconPosition="only" />
            <Button size="xl" iconPosition="only" variant="hover" />
            <Button size="xl" iconPosition="only" variant="focused-dark" />
            <Button size="xl" iconPosition="only" variant="focused-light" />
            <Button size="xl" iconPosition="only" variant="disabled" />
          </div>
        </div>

        {/* LG Buttons - Plain */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">LG Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button size="lg">LG Font</Button>
            <Button size="lg" variant="hover">LG Font</Button>
            <Button size="lg" variant="focused-dark">LG Font</Button>
            <Button size="lg" variant="focused-light">LG Font</Button>
            <Button size="lg" variant="disabled">LG Font</Button>
          </div>
        </div>

        {/* LG Buttons - With Left Icon */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">LG with Left Icon</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" iconPosition="left">LG Font</Button>
            <Button size="lg" iconPosition="left" variant="hover">LG Font</Button>
            <Button size="lg" iconPosition="left" variant="focused-dark">LG Font</Button>
            <Button size="lg" iconPosition="left" variant="focused-light">LG Font</Button>
            <Button size="lg" iconPosition="left" variant="disabled">LG Font</Button>
          </div>
        </div>

        {/* LG Buttons - With Right Icon */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">LG with Right Icon</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" iconPosition="right">LG Font</Button>
            <Button size="lg" iconPosition="right" variant="hover">LG Font</Button>
            <Button size="lg" iconPosition="right" variant="focused-dark">LG Font</Button>
            <Button size="lg" iconPosition="right" variant="focused-light">LG Font</Button>
            <Button size="lg" iconPosition="right" variant="disabled">LG Font</Button>
          </div>
        </div>

        {/* LG Buttons - Icon Only */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">LG Icon Only</h3>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" iconPosition="only" />
            <Button size="lg" iconPosition="only" variant="hover" />
            <Button size="lg" iconPosition="only" variant="focused-dark" />
            <Button size="lg" iconPosition="only" variant="focused-light" />
            <Button size="lg" iconPosition="only" variant="disabled" />
          </div>
        </div>

        {/* Interactive Example */}
        <div className="space-y-4 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Interactive Example</h2>
          <div className="flex flex-wrap gap-4">
            <Button 
              size="xl" 
              iconPosition="left" 
              onClick={() => alert('Button clicked!')}
            >
              Click Me
            </Button>
            <Button 
              size="lg" 
              iconPosition="right"
              onClick={() => alert('LG button clicked!')}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
