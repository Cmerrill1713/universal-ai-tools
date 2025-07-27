import React from 'react';
import {
  Provider,
  defaultTheme,
  Button,
  TextField,
  Dialog,
  DialogTrigger,
  ActionButton,
  Flex,
  View,
  Heading,
  Text,
  Well,
  StatusLight,
  ProgressBar,
  Slider,
  Switch,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  Menu,
  MenuTrigger,
  Item,
  ActionMenu,
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

        {/* Buttons Section */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Buttons
          </Heading>
          <Flex gap="size-200" wrap>
            <Button variant="accent">Accent Button</Button>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="negative">Negative Button</Button>
            <ActionButton>Action Button</ActionButton>
          </Flex>
        </View>

        {/* Form Controls */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Form Controls
          </Heading>
          <Flex direction="column" gap="size-200">
            <TextField label="Text Field" placeholder="Enter some text" />
            <TextField label="Email Field" type="email" placeholder="email@example.com" />
            <Slider label="Volume" value={sliderValue} onChange={setSliderValue} maxValue={100} />
            <Switch isSelected={switchValue} onChange={setSwitchValue}>
              Toggle Feature
            </Switch>
          </Flex>
        </View>

        {/* Selection Controls */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Selection Controls
          </Heading>
          <Flex gap="size-400">
            <RadioGroup label="Choose an option">
              <Radio value="option1">Option 1</Radio>
              <Radio value="option2">Option 2</Radio>
              <Radio value="option3">Option 3</Radio>
            </RadioGroup>

            <CheckboxGroup
              label="Select multiple"
              value={checkboxValues}
              onChange={setCheckboxValues}
            >
              <Checkbox value="option1">Option 1</Checkbox>
              <Checkbox value="option2">Option 2</Checkbox>
              <Checkbox value="option3">Option 3</Checkbox>
            </CheckboxGroup>
          </Flex>
        </View>

        {/* Status Indicators */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Status Indicators
          </Heading>
          <Flex gap="size-200" alignItems="center">
            <StatusLight variant="positive">Online</StatusLight>
            <StatusLight variant="negative">Offline</StatusLight>
            <StatusLight variant="notice">Warning</StatusLight>
            <StatusLight variant="info">Information</StatusLight>
          </Flex>
          <ProgressBar label="Loading..." value={75} marginTop="size-200" />
        </View>

        {/* Dialogs and Menus */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Dialogs and Menus
          </Heading>
          <Flex gap="size-200">
            <DialogTrigger>
              <ActionButton>Open Dialog</ActionButton>
              <Dialog>
                <Heading>Dialog Title</Heading>
                <Content>
                  <Text>This is a dialog with some content inside.</Text>
                </Content>
              </Dialog>
            </DialogTrigger>

            <MenuTrigger>
              <ActionButton>Open Menu</ActionButton>
              <Menu onAction={(key) => alert(`Selected: ${key}`)}>
                <Item key="cut">Cut</Item>
                <Item key="copy">Copy</Item>
                <Item key="paste">Paste</Item>
              </Menu>
            </MenuTrigger>

            <ActionMenu onAction={(key) => alert(`Action: ${key}`)}>
              <Item key="edit">Edit</Item>
              <Item key="delete">Delete</Item>
              <Item key="share">Share</Item>
            </ActionMenu>
          </Flex>
        </View>

        {/* Tabs */}
        <View marginBottom="size-400">
          <Heading level={2} marginBottom="size-200">
            Tabs
          </Heading>
          <Tabs aria-label="Spectrum tabs example">
            <TabList>
              <Item key="overview">Overview</Item>
              <Item key="details">Details</Item>
              <Item key="settings">Settings</Item>
            </TabList>
            <TabPanels>
              <Item key="overview">
                <View padding="size-200">
                  <Text>This is the overview tab content.</Text>
                </View>
              </Item>
              <Item key="details">
                <View padding="size-200">
                  <Text>This is the details tab content.</Text>
                </View>
              </Item>
              <Item key="settings">
                <View padding="size-200">
                  <Text>This is the settings tab content.</Text>
                </View>
              </Item>
            </TabPanels>
          </Tabs>
        </View>

        {/* Well Component */}
        <View>
          <Heading level={2} marginBottom="size-200">
            Well Component
          </Heading>
          <Well>
            <Text>This is content inside a Well component, which provides visual grouping.</Text>
          </Well>
        </View>
      </View>
    </Provider>
  );
};
