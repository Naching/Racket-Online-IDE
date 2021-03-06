var library = `
#Constants
num-e = 2.718281828459045;
num-pi = 3.141592653589793;

#max function
num-max = lambda(a, b) if a > b then{a} else{b};

#min function
num-min = lambda(a, b) if a < b then{a} else{b};

#exponential function
num-exp = lambda(a) num-e ^ a;

#abs function
num-abs = lambda(a) if a > 0 then{a} else{0 - a};
`
