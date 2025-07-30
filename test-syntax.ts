// Test file with intentional syntax issues to verify workflow
const testFunction = () => {
    console.log("Testing syntax validation workflow")
    const unused_variable = "This should trigger a warning";
}

// Missing semicolon and unused variable to test auto-fix
export { testFunction }