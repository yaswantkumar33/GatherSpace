module.exports = async ({ email, subject, message }) => {
  console.log("--- sendEmail stub ---");
  console.log("To:", email);
  console.log("Subject:", subject);
  console.log("Message:", message);
  console.log("--- end email ---");
  return Promise.resolve();
};
