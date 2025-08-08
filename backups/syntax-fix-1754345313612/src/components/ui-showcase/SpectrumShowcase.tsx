import React from 'react';
import {
  Provider,
  defaultTheme,
  Button,
  TextField,
  Slider,
  Switch,
  CheckboxGroup,
  Checkbox,
  RadioGroup,
  Radio,
  View,
  Heading,
  Flex,
  ActionButton,
  ProgressBar,
  Tabs,
  TabList,
  TabPanels,
  Content,
} from '@adobe/react-spectrum';

export const SpectrumShowcase: React.FC = () => {
  const [sliderValue, setSliderValue] = React.useState(50);
  const [switchValue, setSwitchValue] = React.useState(false);
  const [checkboxValues, setCheckboxValues] = React.useState(['option1']);

  return (
    <Provider theme={defaultTheme}>
      <View padding="size-500">
        <Heading level={1} marginBottom="size-300">
          Adobe React Spectrum Showcase
        </Heading>

        <Tabs aria-label="Spectrum Component Examples">
          <TabList>
            <Content key="forms">Forms</Content>
            <Content key="actions">Actions</Content>
            <Content key="status">Status</Content>
          </TabList>
          <TabPanels>
            <Content key="forms">
              <View padding="size-300">
                <Flex direction="column" gap="size-300" maxWidth="size-3000">
                  <TextField
                    label="Name"
                    placeholder="Enter your name"
                    width="100%"
                  />
                  
                  <Slider
                    label="Volume"
                    minValue={0}
                    maxValue={100}
                    value={sliderValue}
                    onChange={setSliderValue}
                    width="100%"
                  />
                  
                  <Switch isSelected={switchValue} onChange={setSwitchValue}>
                    Enable notifications
                  </Switch>
                  
                  <CheckboxGroup
                    label="Preferences"
                    value={checkboxValues}
                    onChange={setCheckboxValues}
                  >
                    <Checkbox value="option1">Option 1</Checkbox>
                    <Checkbox value="option2">Option 2</Checkbox>
                    <Checkbox value="option3">Option 3</Checkbox>
                  </CheckboxGroup>
                  
                  <RadioGroup label="Theme" defaultValue="light">
                    <Radio value="light">Light</Radio>
                    <Radio value="dark">Dark</Radio>
                    <Radio value="auto">Auto</Radio>
                  </RadioGroup>
                </Flex>
              </View>
            </Content>

            <Content key="actions">
              <View padding="size-300">
                <Flex direction="column" gap="size-300" alignItems="start">
                  <Button variant="cta">Primary Action</Button>
                  <Button variant="primary">Secondary Action</Button>
                  <Button variant="secondary">Tertiary Action</Button>
                  <ActionButton>Action Button</ActionButton>
                </Flex>
              </View>
            </Content>

            <Content key="status">
              <View padding="size-300">
                <Flex direction="column" gap="size-300">
                  <ProgressBar label="Loading..." value={30} />
                  <ProgressBar label="Processing..." isIndeterminate />
                  <View backgroundColor="positive" padding="size-200">
                    <Heading level={4}>Success Message</Heading>
                  </View>
                  <View backgroundColor="notice" padding="size-200">
                    <Heading level={4}>Warning Message</Heading>
                  </View>
                </Flex>
              </View>
            </Content>
          </TabPanels>
        </Tabs>
      </View>
    </Provider>
  );
};